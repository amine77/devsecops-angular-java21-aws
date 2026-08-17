import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RichHtmlArticleComponent } from './rich-html-article.component';

describe('RichHtmlArticleComponent', () => {
  let fixture: ComponentFixture<RichHtmlArticleComponent>;
  let component: RichHtmlArticleComponent;

  function shadowRoot(): ShadowRoot {
    const host = fixture.nativeElement.querySelector('.rich-html-article-host') as HTMLDivElement;
    return host.shadowRoot!;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RichHtmlArticleComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RichHtmlArticleComponent);
    component = fixture.componentInstance;
  });

  it('should extract the body content and inject it into the shadow root, not the light DOM', () => {
    component.content = '<html><head></head><body><h1>Titre</h1></body></html>';
    fixture.detectChanges();

    expect(shadowRoot().innerHTML).toContain('<h1>Titre</h1>');
    expect(fixture.nativeElement.querySelector('h1')).toBeNull();
  });

  it('should extract style text and rewrite :root to :host', () => {
    component.content =
      '<html><head><style>:root{--ink:#111;} h2{color:red;}</style></head><body><p>Texte</p></body></html>';
    fixture.detectChanges();

    const styleTag = shadowRoot().querySelector('style');
    expect(styleTag?.textContent).toContain(':host{--ink:#111;}');
    expect(styleTag?.textContent).not.toContain(':root');
  });

  it('should keep whitelisted Google Fonts links (including bare-origin preconnect hrefs) and drop others', () => {
    component.content = `
      <html><head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">
        <link rel="stylesheet" href="https://evil.example/x.css">
      </head><body><p>Texte</p></body></html>
    `;
    fixture.detectChanges();

    const hrefs = Array.from(shadowRoot().querySelectorAll('link')).map((l) =>
      l.getAttribute('href')
    );
    expect(hrefs).toContain('https://fonts.gstatic.com');
    expect(hrefs.some((h) => h?.startsWith('https://fonts.googleapis.com'))).toBe(true);
    expect(hrefs.some((h) => h?.includes('evil.example'))).toBe(false);
  });

  it('should strip <script> tags (XSS)', () => {
    component.content = '<html><body><script>alert(1)</script><p>Texte sûr</p></body></html>';
    fixture.detectChanges();

    expect(shadowRoot().innerHTML).not.toContain('<script');
    expect(shadowRoot().innerHTML).toContain('Texte sûr');
  });

  it('should strip on* event handler attributes (XSS)', () => {
    component.content = '<html><body><img src="x.png" onerror="alert(1)"></body></html>';
    fixture.detectChanges();

    expect(shadowRoot().innerHTML).not.toContain('onerror');
  });

  it('should strip javascript: URLs (XSS)', () => {
    component.content = '<html><body><a href="javascript:alert(1)">Lien</a></body></html>';
    fixture.detectChanges();

    expect(shadowRoot().innerHTML).not.toContain('javascript:');
  });

  it('should re-render into the shadow root when content changes', () => {
    component.content = '<html><body><p>Premier</p></body></html>';
    fixture.detectChanges();
    expect(shadowRoot().innerHTML).toContain('Premier');

    component.content = '<html><body><p>Second</p></body></html>';
    component.ngOnChanges({
      content: {
        currentValue: component.content,
        previousValue: '',
        firstChange: false,
        isFirstChange: () => false,
      },
    });

    expect(shadowRoot().innerHTML).toContain('Second');
    expect(shadowRoot().innerHTML).not.toContain('Premier');
  });

  it('should strip @import rules from <style> tag content', () => {
    component.content =
      '<html><head><style>@import url("https://evil.example/x.css"); body{background:url(https://evil.example/track.png)}</style></head><body><p>Texte</p></body></html>';
    fixture.detectChanges();

    const styleTag = shadowRoot().querySelector('style');
    expect(styleTag?.textContent).not.toContain('@import');
    expect(styleTag?.textContent).not.toContain('evil.example');
  });

  it('should neutralize disallowed url() origins in <style> CSS while preserving allowed font origins', () => {
    component.content = `<html><head><style>
      body { background: url(https://evil.example/x.png); }
      @font-face { src: url(https://fonts.gstatic.com/s/inter/v1/font.woff2); }
    </style></head><body><p>Texte</p></body></html>`;
    fixture.detectChanges();

    const styleTag = shadowRoot().querySelector('style');
    expect(styleTag?.textContent).not.toContain('evil.example');
    expect(styleTag?.textContent).toContain('url(https://fonts.gstatic.com/s/inter/v1/font.woff2)');
  });

  it('should neutralize a disallowed url() inside an inline style="" attribute', () => {
    component.content =
      '<html><body><p style="background:url(https://evil.example/x.png)">Texte</p></body></html>';
    fixture.detectChanges();

    expect(shadowRoot().innerHTML).not.toContain('evil.example');
  });

  it('should produce exactly one copy of a body-level <style> tag content in the shadow root', () => {
    component.content = '<html><body><style>:root{--ink:#111;}</style><p>Texte</p></body></html>';
    fixture.detectChanges();

    const styleTags = shadowRoot().querySelectorAll('style');
    expect(styleTags.length).toBe(1);
    const occurrences = shadowRoot().innerHTML.split('--ink:#111;').length - 1;
    expect(occurrences).toBe(1);
  });

  it('should strip <form>/<input>/<button> tags (phishing surface) while keeping sibling content', () => {
    component.content =
      '<html><body><form action="https://evil.example/x"><input><button>Submit</button></form><p>Texte sûr</p></body></html>';
    fixture.detectChanges();

    const html = shadowRoot().innerHTML;
    expect(html).not.toContain('<form');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('<button');
    expect(html).toContain('Texte sûr');
  });

  describe('body/html type-selector rewrite (Shadow DOM has no <body>/<html> to match)', () => {
    it('rewrites a standalone body{...} rule to :host{...}', () => {
      component.content =
        '<html><head><style>body{margin:0;color:red;}</style></head><body><p>Texte</p></body></html>';
      fixture.detectChanges();

      const css = shadowRoot().querySelector('style')?.textContent ?? '';
      expect(css).toContain(':host{margin:0;color:red;}');
      expect(css).not.toContain('body{');
    });

    it('rewrites both a standalone html{...} rule and a standalone body{...} rule', () => {
      component.content =
        '<html><head><style>html{font-size:16px;} body{line-height:1.5;}</style></head><body><p>Texte</p></body></html>';
      fixture.detectChanges();

      const css = shadowRoot().querySelector('style')?.textContent ?? '';
      expect(css).toContain(':host{font-size:16px;}');
      expect(css).toContain(':host{line-height:1.5;}');
      expect(css).not.toContain('body{');
      expect(css).not.toContain('html{');
    });

    it('rewrites a standalone body{...} rule nested inside a @media block', () => {
      component.content =
        '<html><head><style>@media (max-width:600px){ body{font-size:18px;} }</style></head><body><p>Texte</p></body></html>';
      fixture.detectChanges();

      const css = shadowRoot().querySelector('style')?.textContent ?? '';
      expect(css).toContain(':host{font-size:18px;}');
      expect(css).not.toContain('body{');
    });

    it('does NOT touch a descendant selector like ".wrap body"', () => {
      component.content =
        '<html><head><style>.wrap body{color:blue;}</style></head><body><p>Texte</p></body></html>';
      fixture.detectChanges();

      const css = shadowRoot().querySelector('style')?.textContent ?? '';
      expect(css).toContain('.wrap body{color:blue;}');
    });

    it('does NOT touch a compound selector like "body.dark-mode"', () => {
      component.content =
        '<html><head><style>body.dark-mode{background:black;}</style></head><body><p>Texte</p></body></html>';
      fixture.detectChanges();

      const css = shadowRoot().querySelector('style')?.textContent ?? '';
      expect(css).toContain('body.dark-mode{background:black;}');
    });

    it('does NOT touch the substring "body" inside a class name like ".article-body"', () => {
      component.content =
        '<html><head><style>.article-body{padding:1rem;}</style></head><body><p>Texte</p></body></html>';
      fixture.detectChanges();

      const css = shadowRoot().querySelector('style')?.textContent ?? '';
      expect(css).toContain('.article-body{padding:1rem;}');
    });

    it('rewrites body in a selector list while leaving the other selector untouched', () => {
      component.content =
        '<html><head><style>body, .highlight{color:green;}</style></head><body><p>Texte</p></body></html>';
      fixture.detectChanges();

      const css = shadowRoot().querySelector('style')?.textContent ?? '';
      expect(css).toContain(':host, .highlight{color:green;}');
    });
  });

  describe('sanitizeCssUrls hardening (comment-broken url(), no-whitespace @import, image-set())', () => {
    it('strips a no-whitespace @import ("@import" immediately followed by the string token)', () => {
      component.content =
        '<html><head><style>@import"https://evil.example/x.css";</style></head><body><p>Texte</p></body></html>';
      fixture.detectChanges();

      const css = shadowRoot().querySelector('style')?.textContent ?? '';
      expect(css).not.toContain('evil.example');
      expect(css).not.toContain('@import');
    });

    it('neutralizes a url() whose quoted argument is preceded by a CSS comment', () => {
      component.content =
        '<html><head><style>body{background:url(/*c*/"https://evil.example/x.png")}</style></head><body><p>Texte</p></body></html>';
      fixture.detectChanges();

      const css = shadowRoot().querySelector('style')?.textContent ?? '';
      expect(css).not.toContain('evil.example');
    });

    it('neutralizes a disallowed origin carried by image-set() (a non-url() URL-bearing function)', () => {
      component.content =
        '<html><head><style>body{background:image-set("https://evil.example/x.png" 1x)}</style></head><body><p>Texte</p></body></html>';
      fixture.detectChanges();

      const css = shadowRoot().querySelector('style')?.textContent ?? '';
      expect(css).not.toContain('evil.example');
    });

    it('positive control: preserves an allowed font origin url() verbatim', () => {
      component.content =
        '<html><head><style>@font-face{src:url(https://fonts.gstatic.com/s/inter/v1/font.woff2);}</style></head><body><p>Texte</p></body></html>';
      fixture.detectChanges();

      const css = shadowRoot().querySelector('style')?.textContent ?? '';
      expect(css).toContain('https://fonts.gstatic.com/s/inter/v1/font.woff2');
    });
  });
});
