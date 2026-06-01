"""Trifecta MCP server (FastMCP, Streamable HTTP) — the Signal backend.

Exposes the Phase 0 MMM tools, grounded in the fitted Meridian model's posterior
outputs. Every tool returns credible intervals. Runs on Cloud Run over Streamable
HTTP so the Anthropic Messages API can attach it via the `mcp_servers` parameter.
"""
from __future__ import annotations

import logging

from mcp.server.fastmcp import FastMCP

from .config import ServerConfig
from .engine import MMMEngine
from .loader import load_results

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-7s %(name)s %(message)s")
log = logging.getLogger("trifecta-mcp")

_cfg = ServerConfig()
_engine = MMMEngine(load_results(_cfg))
log.info("Loaded model for client=%s · channels=%s", _cfg.client_name, _engine.channels)

mcp = FastMCP("Trifecta MMM", host=_cfg.host, port=_cfg.port)


@mcp.tool()
def get_channel_contribution() -> dict:
    """Incremental revenue and ROI driven by each marketing channel, with 90%
    credible intervals. Use for "which channels drive revenue?" / "what's working?"."""
    return _engine.channel_contribution()


@mcp.tool()
def get_marginal_roi() -> dict:
    """Return on the *next* dollar of spend in each channel (marginal ROI), with
    credible intervals. Use for "where should the next dollar go?"."""
    return _engine.marginal_roi()


@mcp.tool()
def get_response_curve(channel: str) -> dict:
    """The saturation (response) curve for one channel: incremental revenue vs.
    spend, with a credible band. `channel` may be a display name (e.g. "Meta",
    "TV") or a raw channel id. Use for "is channel X saturated?" / diminishing returns."""
    return _engine.response_curve(channel)


@mcp.tool()
def run_budget_scenario(changes: dict[str, float]) -> dict:
    """Project the revenue outcome of a proposed spend plan, with a credible
    interval. `changes` maps channel name -> new absolute spend; channels omitted
    keep their current spend. Use for "what if I move $X from A to B?"."""
    return _engine.run_budget_scenario(changes)


@mcp.tool()
def optimize_budget(total_budget: float | None = None) -> dict:
    """Meridian's optimal allocation across channels. With no argument, returns the
    optimal split for the current total budget (vs. the current plan), with the
    expected lift and credible intervals. Pass `total_budget` to allocate a
    different total. Use for "optimise my budget" / "best allocation"."""
    return _engine.optimize_budget(total_budget)


@mcp.tool()
def get_model_health() -> dict:
    """Model diagnostics: convergence (R-hat), holdout error (MAPE / R²), training
    window and when it was trained. Use to judge how much to trust the numbers."""
    return _engine.model_health()


def main() -> None:
    log.info("Starting Trifecta MCP server on %s:%d (streamable-http)", _cfg.host, _cfg.port)
    mcp.run(transport="streamable-http")


if __name__ == "__main__":
    main()
