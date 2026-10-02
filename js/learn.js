/**
 * The "Learn" drawer: a slide-over with the explanations from educational-content.js.
 * Anything on the page with a data-term attribute opens it at that topic.
 */

import { EDUCATIONAL_CONTENT, getCategoryContent, getContent } from './educational-content.js';

export class Learn {
    constructor() {
        this.root = document.getElementById('drawer');
        this.body = document.getElementById('drawer-body');
        this.tabs = [...this.root.querySelectorAll('[role="tab"]')];
        this.category = 'concepts';
        this.lastFocus = null;

        this.tabs.forEach((t) => t.addEventListener('click', () => this.list(t.dataset.category)));
        this.root.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', () => this.close()));
        document.addEventListener('keydown', (e) => e.key === 'Escape' && !this.root.hidden && this.close());
        document.addEventListener('click', (e) => {
            const el = e.target.closest('[data-term]');
            if (el) {
                e.preventDefault();
                this.show(el.dataset.term);
            }
        });
        document.getElementById('learn-btn').addEventListener('click', () => {
            this.open();
            this.list(this.category);
        });
    }

    open() {
        if (this.root.hidden) {
            this.lastFocus = document.activeElement;
            this.root.hidden = false;
            this.root.querySelector('[data-close].icon-btn').focus();
        }
    }

    close() {
        this.root.hidden = true;
        this.lastFocus?.focus?.();
    }

    list(category) {
        this.category = category;
        this.tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.category === category)));
        const items = Object.entries(getCategoryContent(category));
        this.body.innerHTML = items
            .map(
                ([id, it]) =>
                    `<button class="topic ${it.termType ?? ''}" data-term="${id}"><strong>${it.title}</strong><span>${it.shortDesc}</span></button>`,
            )
            .join('');
        this.body.scrollTop = 0;
    }

    show(id) {
        const it = getContent(id);
        if (!it) return;
        this.open();
        this.category = Object.keys(EDUCATIONAL_CONTENT).find((c) => id in EDUCATIONAL_CONTENT[c]) ?? this.category;
        this.tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.category === this.category)));
        const related = (it.relatedTerms ?? [])
            .map((r) => [r, getContent(r)])
            .filter(([, c]) => c)
            .map(([r, c]) => `<button data-term="${r}">${c.title}</button>`)
            .join('');
        this.body.innerHTML = `
            <button class="back" data-back>← All topics</button>
            <article class="article"><h2>${it.title}</h2>${it.content}</article>
            ${related ? `<div class="related"><h4>Related</h4>${related}</div>` : ''}`;
        this.body.querySelector('[data-back]').addEventListener('click', () => this.list(this.category));
        this.body.scrollTop = 0;
    }
}
