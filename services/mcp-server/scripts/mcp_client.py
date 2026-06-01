#!/usr/bin/env python3
"""Tiny CLI to exercise the deployed Trifecta MCP server.

Usage:
  python scripts/mcp_client.py                         # list tools
  python scripts/mcp_client.py get_model_health
  python scripts/mcp_client.py get_response_curve '{"channel": "TikTok"}'
  python scripts/mcp_client.py optimize_budget
  python scripts/mcp_client.py run_budget_scenario '{"changes": {"Meta": 60000000}}'

Env:
  MCP_URL  (default: the deployed Cloud Run URL)
"""
import asyncio
import json
import os
import sys

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

URL = os.environ.get("MCP_URL", "https://trifecta-mcp-781866440451.asia-southeast1.run.app/mcp")


async def main():
    tool = sys.argv[1] if len(sys.argv) > 1 else None
    args = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
    async with streamablehttp_client(URL) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            if not tool:
                tools = await session.list_tools()
                for t in tools.tools:
                    print(f"- {t.name}: {(t.description or '').splitlines()[0]}")
                return
            res = await session.call_tool(tool, args)
            print(json.dumps(json.loads(res.content[0].text), indent=2))


if __name__ == "__main__":
    asyncio.run(main())
