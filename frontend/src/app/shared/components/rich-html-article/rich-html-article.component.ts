import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import createDOMPurify from 'dompurify';

const ALLOWED_FONT_ORIGINS = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

const RICH_HTML_SANITIZE_CONFIG = {
  ADD_TAGS: ['style', 'link'],
  ADD_ATTR: ['rel', 'href', 'crossorigin'],
  // Designed articles have no legitimate need for interactive forms; a <form> rendered
  // inside the Shadow DOM would still submit to whatever origin its action points at
  // (the shadow boundary does not restrict form submission), which is a phishing surface
  // hosted on our own origin. Strip the whole family.
  FORBID_TAGS: ['form', 'input', 'button', 'textarea', 'select'],
  // Without this, DOMPurify's internal DOMParser().parseFromString(dirty, 'text/html')
  // auto-hoists the leading <link>/<style> tags into an implicit <head> (standard HTML5
  // fragment-parsing behavior), and DOMPurify's default (non-WHOLE_DOCUMENT) sanitize only
  // serializes the <body> subtree — silently dropping them. WHOLE_DOCUMENT: true makes it
  // serialize head+body together; the same ALLOWED_TAGS/hooks still apply to both. When the
  // resulting <html><head>…</head><body>…</body></html> string is assigned to
  // shadowRoot.innerHTML, the wrapper tags are discarded per HTML fragment-parsing rules and
  // only their children remain, so this does not change the shape of the rendered output.
  WHOLE_DOCUMENT: true,
};

function isAllowedFontOrigin(href: string | null): boolean {
  if (!href) {
    return false;
  }
  try {
    return ALLOWED_FONT_ORIGINS.includes(new URL(href).origin);
  } catch {
    return false;
  }
}

// The <link>-level origin whitelist only guards <link href="...">; CSS itself can load
// arbitrary remote resources via @import and url(...) (stylesheets, fonts, background
// images), both in <style> tag bodies and in inline style="" attributes. Neither is
// touched by DOMPurify (it doesn't parse CSS), so this closes that gap by stripping
// @import outright and rewriting url(...) to keep only data: URIs and the same allowed
// font origins already enforced on <link>.
function sanitizeCssUrls(css: string): string {
  let result = css.replace(/@import\s+[^;]*;?/gi, '');
  result = result.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (match, _quote, rawUrl) => {
    const trimmed = rawUrl.trim();
    if (trimmed.startsWith('data:')) {
      return match;
    }
    return isAllowedFontOrigin(trimmed) ? match : 'url()';
  });
  return result;
}

const purifier = createDOMPurify(window);
purifier.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'LINK' && !isAllowedFontOrigin(node.getAttribute('href'))) {
    node.remove();
  }
});

/**
 * Rend un article "HTML designé" (document HTML autonome collé tel quel,
 * avec son propre <style> et ses polices Google Fonts) en isolant son CSS
 * du reste du site via un Shadow DOM natif.
 */
@Component({
  selector: 'app-rich-html-article',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #host class="rich-html-article-host"></div>`,
})
export class RichHtmlArticleComponent implements AfterViewInit, OnChanges {
  @Input() content = '';

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;

  private shadowRoot: ShadowRoot | null = null;
  private viewReady = false;

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.render();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['content'] && this.viewReady) {
      this.render();
    }
  }

  private render(): void {
    if (!this.shadowRoot) {
      this.shadowRoot = this.hostRef.nativeElement.attachShadow({ mode: 'open' });
    }
    this.shadowRoot.innerHTML = this.buildSanitizedMarkup(this.content);
  }

  private buildSanitizedMarkup(rawDocument: string): string {
    const parsed = new DOMParser().parseFromString(rawDocument, 'text/html');

    const linkElements = Array.from(parsed.querySelectorAll('link'));
    const links = linkElements
      .filter((link) => isAllowedFontOrigin(link.getAttribute('href')))
      .map((link) => link.outerHTML)
      .join('\n');

    const styleElements = Array.from(parsed.querySelectorAll('style'));
    const style = styleElements
      .map((el) => this.sanitizeStyleContent(el.textContent ?? ''))
      .join('\n');

    // Remove the harvested <link>/<style> elements from the parsed tree so no
    // unrewritten/unfiltered duplicate survives inside parsed.body.innerHTML below.
    [...linkElements, ...styleElements].forEach((el) => el.remove());

    Array.from(parsed.body?.querySelectorAll('[style]') ?? []).forEach((el) => {
      el.setAttribute('style', sanitizeCssUrls(el.getAttribute('style') ?? ''));
    });

    const body = parsed.body?.innerHTML ?? '';

    const combined = `${links}\n<style>${style}</style>\n${body}`;

    return purifier.sanitize(combined, RICH_HTML_SANITIZE_CONFIG);
  }

  private sanitizeStyleContent(css: string): string {
    return sanitizeCssUrls(css).replace(/:root\b/g, ':host');
  }
}
