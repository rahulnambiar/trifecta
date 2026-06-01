"""Build the Meridian model spec, sample the posterior, and persist the fit.

Follows the Getting Started flow: a LogNormal ROI prior, the auto-knot-selection
(AKS) model spec, NUTS sampling. The fitted model is saved as ``model.pkl`` via
the legacy ``model.save_mmm`` so the MCP server (M2) can load it back with
``model.load_mmm``. (``save_mmm`` is deprecated in favour of ``meridian_serde``,
but we keep the .pkl artifact contract Phase 0 depends on.)
"""
from __future__ import annotations

import logging
import warnings

import numpy as np
import tensorflow_probability as tfp

from meridian import constants
from meridian.model import model, prior_distribution, spec

from .config import RunnerConfig

log = logging.getLogger(__name__)


def build_holdout_id(data, holdout_weeks: int) -> np.ndarray | None:
    """Boolean (n_geos, n_times) mask marking the last ``holdout_weeks`` as test."""
    if holdout_weeks <= 0:
        return None
    n_geos, n_times = data.kpi.shape[0], data.kpi.shape[1]
    holdout = np.zeros((n_geos, n_times), dtype=bool)
    holdout[:, -holdout_weeks:] = True
    log.info("Holdout: last %d of %d weeks held out for validation.", holdout_weeks, n_times)
    return holdout


def build_model(data, cfg: RunnerConfig):
    """Construct a ``Meridian`` model with a LogNormal ROI prior."""
    prior = prior_distribution.PriorDistribution(
        roi_m=tfp.distributions.LogNormal(cfg.roi_mu, cfg.roi_sigma, name=constants.ROI_M)
    )
    spec_kwargs = dict(prior=prior, enable_aks=cfg.enable_aks)
    holdout = build_holdout_id(data, cfg.holdout_weeks)
    if holdout is not None:
        spec_kwargs["holdout_id"] = holdout

    model_spec = spec.ModelSpec(**spec_kwargs)
    mmm = model.Meridian(input_data=data, model_spec=model_spec)
    return mmm


def fit(mmm, cfg: RunnerConfig):
    """Sample the prior then the posterior (NUTS)."""
    log.info("Sampling prior: %d draws", cfg.n_prior_draws)
    mmm.sample_prior(cfg.n_prior_draws)

    log.info(
        "Sampling posterior (NUTS): chains=%d adapt=%d burnin=%d keep=%d",
        cfg.n_chains, cfg.n_adapt, cfg.n_burnin, cfg.n_keep,
    )
    mmm.sample_posterior(
        n_chains=cfg.n_chains,
        n_adapt=cfg.n_adapt,
        n_burnin=cfg.n_burnin,
        n_keep=cfg.n_keep,
        seed=cfg.seed,
    )
    return mmm


def save_model(mmm, path: str) -> str:
    """Persist the fitted model to ``path`` (a .pkl). Returns the path."""
    log.info("Saving fitted model to %s", path)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", DeprecationWarning)
        model.save_mmm(mmm, path)
    return path
