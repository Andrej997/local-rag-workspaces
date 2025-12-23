import re
from datetime import datetime
from urllib.parse import urlparse
from typing import Optional, Tuple

from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout
from utils.logger import get_logger
from utils.validators import validate_url

logger = get_logger(__name__)


class ScraperService:
    """Service for web scraping using Playwright and PDF generation."""

    def __init__(self):
        self.timeout = 60000  # 60 seconds


    async def scrape_url(self, url: str) -> bytes:
        """
        Scrape a URL and return a PDF with full-page screenshot.

        Args:
            url: The URL to scrape

        Returns:
            PDF bytes

        Raises:
            ValueError: If URL validation fails
            TimeoutError: If page load times out
            Exception: For other scraping errors
        """
        # Validate URL using centralized validator (improved SSRF protection)
        is_valid, error_msg = validate_url(url, allow_private=False)
        if not is_valid:
            raise ValueError(error_msg)

        logger.info(f"Starting scrape for URL: {url}")

        try:
            async with async_playwright() as p:
                # Launch browser with stealth options
                # Note: --no-sandbox is required in Docker but reduces security
                browser = await p.chromium.launch(
                    headless=True,
                    args=[
                        '--no-sandbox',  # Required for Docker
                        '--disable-setuid-sandbox',  # Required for Docker
                        '--disable-blink-features=AutomationControlled',
                        '--disable-dev-shm-usage',
                        # Removed '--disable-web-security' - security risk
                    ]
                )

                try:
                    # Create new page with realistic viewport and user agent
                    page = await browser.new_page(
                        viewport={'width': 1920, 'height': 1080},
                        user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    )

                    # Add extra headers to appear more like a real browser
                    await page.set_extra_http_headers({
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'DNT': '1',
                        'Connection': 'keep-alive',
                        'Upgrade-Insecure-Requests': '1'
                    })

                    # Remove webdriver flag
                    await page.add_init_script("""
                        Object.defineProperty(navigator, 'webdriver', {
                            get: () => undefined
                        });
                    """)

                    # Navigate to URL
                    try:
                        # Use 'domcontentloaded' instead of 'networkidle' for faster loading
                        # Many sites (like Medium) have continuous network activity
                        await page.goto(
                            url,
                            timeout=self.timeout,
                            wait_until='domcontentloaded'
                        )

                        # Wait for page to stabilize and content to load
                        # This is more reliable than networkidle for sites with analytics/ads
                        await page.wait_for_timeout(3000)

                        # Try to scroll to trigger lazy-loaded content
                        try:
                            await page.evaluate("""
                                window.scrollTo(0, document.body.scrollHeight / 2);
                            """)
                            await page.wait_for_timeout(1000)
                            await page.evaluate("window.scrollTo(0, 0);")
                            await page.wait_for_timeout(500)
                        except:
                            pass

                    except PlaywrightTimeout:
                        logger.error(f"Timeout loading page: {url}")
                        raise TimeoutError(f"Page load timeout after {self.timeout/1000}s")
                    except Exception as e:
                        logger.error(f"Error navigating to {url}: {str(e)}")
                        raise Exception(f"Cannot reach page: {str(e)}")

                    # Check if we hit a Cloudflare or bot detection page
                    page_content = await page.content()
                    if 'cloudflare' in page_content.lower() and 'checking your browser' in page_content.lower():
                        logger.warning(f"Cloudflare challenge detected for {url}, waiting...")
                        # Wait for challenge to complete (up to 10 seconds)
                        try:
                            await page.wait_for_load_state('networkidle', timeout=10000)
                        except:
                            pass

                    # Generate PDF directly from page (preserves text, not just images)
                    pdf_bytes = await page.pdf(
                        format='A4',
                        print_background=True,
                        margin={
                            'top': '20px',
                            'right': '20px',
                            'bottom': '20px',
                            'left': '20px'
                        },
                        display_header_footer=True,
                        header_template='<div></div>',
                        footer_template=f'''
                            <div style="font-size: 9px; text-align: center; width: 100%; color: #999;">
                                <span>Scraped from: {url}</span> |
                                <span class="pageNumber"></span>/<span class="totalPages"></span>
                            </div>
                        '''
                    )

                    logger.info(f"PDF generated: {len(pdf_bytes)} bytes")

                finally:
                    # Always close browser
                    await browser.close()

                return pdf_bytes

        except TimeoutError:
            raise
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Scraping failed for {url}: {str(e)}")
            raise Exception(f"Scraping failed: {str(e)}")


# Singleton instance
_scraper_service = None


def get_scraper_service() -> ScraperService:
    """Get singleton instance of ScraperService."""
    global _scraper_service
    if _scraper_service is None:
        _scraper_service = ScraperService()
    return _scraper_service
