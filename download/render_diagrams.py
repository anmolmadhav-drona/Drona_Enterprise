#!/usr/bin/env python3
"""Render diagram HTML to PNG at 2x device scale (300dpi equivalent)."""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

DIAGRAMS = [
    ("diagram_flow.html", "diagram_flow.png", 1200, 720),
    ("diagram_hierarchy.html", "diagram_hierarchy.png", 1200, 720),
]

def render(html_name: str, png_name: str, width: int, height: int):
    base = Path(__file__).parent.resolve()
    html_path = base / html_name
    png_path = base / png_name
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(
            viewport={"width": width, "height": height},
            device_scale_factor=2,
        )
        page = ctx.new_page()
        page.goto(html_path.as_uri())
        page.wait_for_load_state("networkidle")
        # Allow web fonts a moment to settle
        page.wait_for_timeout(400)
        page.screenshot(path=str(png_path), full_page=False, omit_background=False,
                        clip={"x": 0, "y": 0, "width": width, "height": height})
        browser.close()
    print(f"Rendered: {png_path}")

if __name__ == "__main__":
    targets = DIAGRAMS if not sys.argv[1:] else [(sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]))]
    for html_name, png_name, w, h in targets:
        render(html_name, png_name, w, h)
