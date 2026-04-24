import { Component } from '@angular/core';

@Component({
  selector: 'app-header',
  standalone: true,
  template: `
    <header>
      <div class="logo">
        <div class="logo-mark">i</div>
        <div class="logo-text">
          <strong>Process Mining</strong>
          <span>Log Validator · Data Product</span>
        </div>
      </div>
      <div class="fw-badge">
        <span class="dot"></span> Angular 17
      </div>
    </header>
  `,
  styles: [`
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 32px 0 40px;
      border-bottom: 1px solid var(--orange-border);
      margin-bottom: 52px;
    }
    .logo { display: flex; align-items: center; gap: 14px; }
    .logo-mark {
      width: 42px; height: 42px;
      background: var(--orange);
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-family: 'Playfair Display', serif;
      font-size: 22px; font-weight: 700; color: #fff;
      box-shadow: 0 4px 20px rgba(236,112,0,0.35);
    }
    .logo-text strong {
      display: block;
      font-family: 'Playfair Display', serif;
      font-size: 17px; font-weight: 700;
    }
    .logo-text span {
      display: block; font-size: 10px; color: var(--orange);
      letter-spacing: 0.18em; text-transform: uppercase; margin-top: 2px;
    }
    .fw-badge {
      background: var(--surface3);
      border: 1px solid var(--border2);
      color: var(--text-dim);
      padding: 5px 12px; border-radius: 6px;
      font-size: 10px; letter-spacing: 0.1em;
      display: flex; align-items: center; gap: 6px;
    }
    .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--orange); }
  `]
})
export class HeaderComponent {}
