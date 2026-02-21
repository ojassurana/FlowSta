from __future__ import annotations

import threading
import time
import logging
from collections import deque

import numpy as np

from backend.config import get_settings

logger = logging.getLogger(__name__)

# Muse 2 channel layout
CHANNELS = ["TP9", "AF7", "AF8", "TP10"]
FRONTAL_CHANNELS = [1, 2]  # AF7, AF8 indices
SAMPLE_RATE = 256
ARTIFACT_THRESHOLD_UV = 200.0


class EEGProcessor:
    """Reads LSL EEG stream, computes focus metrics via FFT."""

    _instance: EEGProcessor | None = None
    _lock = threading.Lock()

    def __init__(self) -> None:
        settings = get_settings()
        self._window_samples = int(settings.eeg_window_seconds * SAMPLE_RATE)
        self._step_samples = int(settings.eeg_step_seconds * SAMPLE_RATE)
        self._lsl_timeout = settings.eeg_lsl_timeout

        self._buffer: deque[list[float]] = deque(maxlen=self._window_samples)
        self._latest_metrics: dict | None = None
        self._subscribers: list = []
        self._running = False
        self._thread: threading.Thread | None = None
        self._connected = False

    @classmethod
    def get_instance(cls) -> EEGProcessor:
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    @property
    def connected(self) -> bool:
        return self._connected

    @property
    def latest_metrics(self) -> dict | None:
        return self._latest_metrics

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._read_loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._running = False
        self._connected = False
        if self._thread:
            self._thread.join(timeout=3)
            self._thread = None

    def subscribe(self, queue) -> None:
        self._subscribers.append(queue)

    def unsubscribe(self, queue) -> None:
        try:
            self._subscribers.remove(queue)
        except ValueError:
            pass

    def _read_loop(self) -> None:
        try:
            from pylsl import StreamInlet, resolve_stream

            logger.info("Resolving LSL EEG stream (timeout=%.1fs)...", self._lsl_timeout)
            streams = resolve_stream("type", "EEG", 1, self._lsl_timeout)
            if not streams:
                logger.warning("No LSL EEG stream found")
                self._connected = False
                self._running = False
                self._publish_no_signal()
                return

            inlet = StreamInlet(streams[0])
            self._connected = True
            logger.info("Connected to LSL EEG stream")

            samples_since_compute = 0

            while self._running:
                sample, timestamp = inlet.pull_sample(timeout=1.0)
                if sample is None:
                    continue

                self._buffer.append(sample[:4])
                samples_since_compute += 1

                if (
                    len(self._buffer) >= self._window_samples
                    and samples_since_compute >= self._step_samples
                ):
                    samples_since_compute = 0
                    self._compute_and_publish()

        except ImportError:
            logger.error("pylsl not installed — EEG processing unavailable")
            self._connected = False
            self._running = False
        except Exception as e:
            logger.error("EEG read loop error: %s", e)
            self._connected = False
            self._running = False

    def _compute_and_publish(self) -> None:
        data = np.array(list(self._buffer))  # shape: (window_samples, 4)

        # Artifact rejection: discard if any channel exceeds threshold
        if np.any(np.abs(data) > ARTIFACT_THRESHOLD_UV):
            self._latest_metrics = {
                "focus_index": 0.0,
                "alpha_power": 0.0,
                "beta_power": 0.0,
                "theta_power": 0.0,
                "timestamp": time.time(),
                "signal_quality": "poor",
            }
            self._publish(self._latest_metrics)
            return

        # FFT per channel
        freqs = np.fft.rfftfreq(self._window_samples, 1.0 / SAMPLE_RATE)
        theta_mask = (freqs >= 4) & (freqs <= 8)
        alpha_mask = (freqs >= 8) & (freqs <= 13)
        beta_mask = (freqs >= 13) & (freqs <= 30)

        theta_powers = []
        alpha_powers = []
        beta_powers = []

        for ch in range(4):
            fft_vals = np.abs(np.fft.rfft(data[:, ch])) ** 2
            theta_powers.append(np.mean(fft_vals[theta_mask]))
            alpha_powers.append(np.mean(fft_vals[alpha_mask]))
            beta_powers.append(np.mean(fft_vals[beta_mask]))

        # Average across frontal channels for focus index
        frontal_beta = np.mean([beta_powers[i] for i in FRONTAL_CHANNELS])
        frontal_alpha = np.mean([alpha_powers[i] for i in FRONTAL_CHANNELS])
        frontal_theta = np.mean([theta_powers[i] for i in FRONTAL_CHANNELS])

        denominator = frontal_alpha + frontal_theta
        focus_index = float(frontal_beta / denominator) if denominator > 0 else 0.0

        self._latest_metrics = {
            "focus_index": round(focus_index, 4),
            "alpha_power": round(float(np.mean(alpha_powers)), 2),
            "beta_power": round(float(np.mean(beta_powers)), 2),
            "theta_power": round(float(np.mean(theta_powers)), 2),
            "timestamp": time.time(),
            "signal_quality": "good",
        }
        self._publish(self._latest_metrics)

    def _publish_no_signal(self) -> None:
        metrics = {
            "focus_index": 0.0,
            "alpha_power": 0.0,
            "beta_power": 0.0,
            "theta_power": 0.0,
            "timestamp": time.time(),
            "signal_quality": "no_signal",
        }
        self._publish(metrics)

    def _publish(self, metrics: dict) -> None:
        dead = []
        for q in self._subscribers:
            try:
                q.put_nowait(metrics)
            except Exception:
                dead.append(q)
        for q in dead:
            self._subscribers.remove(q)
