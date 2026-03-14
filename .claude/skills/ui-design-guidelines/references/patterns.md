# UI Design Patterns Reference

SKILL.mdの原則を具体的なコードパターンで実装するためのリファレンス。

## Table of Contents
1. [Spacing Patterns](#spacing-patterns)
2. [Color System](#color-system)
3. [Button Patterns](#button-patterns)
4. [Typography System](#typography-system)
5. [Form Elements](#form-elements)
6. [Card Components](#card-components)
7. [Navigation Patterns](#navigation-patterns)
8. [Accessibility Patterns](#accessibility-patterns)

---

## Spacing Patterns

### CSS Custom Properties
```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
}
```

### Tailwind Equivalents
```
space-1 = p-1, m-1, gap-1
space-2 = p-2, m-2, gap-2
space-4 = p-4, m-4, gap-4
space-6 = p-6, m-6, gap-6
space-8 = p-8, m-8, gap-8
```

### Application Examples
```css
/* Card internal spacing */
.card {
  padding: var(--space-6);           /* 24px outer padding */
}
.card-header {
  margin-bottom: var(--space-4);     /* 16px below header */
}
.card-title {
  margin-bottom: var(--space-2);     /* 8px below title */
}

/* Form group spacing */
.form-group {
  margin-bottom: var(--space-6);     /* 24px between groups */
}
.form-label {
  margin-bottom: var(--space-2);     /* 8px below label */
}
.form-helper-text {
  margin-top: var(--space-1);        /* 4px above helper */
}

/* Section spacing */
.page-section {
  padding-block: var(--space-16);    /* 64px vertical */
}
.section-header {
  margin-bottom: var(--space-8);     /* 32px below section title */
}
```

---

## Color System

### Semantic Colors
```css
:root {
  /* Text */
  --color-text-primary: #1a1a1a;
  --color-text-secondary: #525252;
  --color-text-tertiary: #737373;
  --color-text-disabled: #a3a3a3;
  --color-text-inverse: #ffffff;
  
  /* Backgrounds */
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f5f5f5;
  --color-bg-tertiary: #e5e5e5;
  
  /* Borders */
  --color-border-default: #d4d4d4;
  --color-border-strong: #a3a3a3;
  --color-border-focus: #2563eb;
  
  /* Interactive */
  --color-primary: #2563eb;
  --color-primary-hover: #1d4ed8;
  --color-primary-active: #1e40af;
  
  /* Feedback */
  --color-success: #16a34a;
  --color-warning: #ca8a04;
  --color-error: #dc2626;
  --color-info: #2563eb;
}
```

### Contrast-Safe Pairs
```css
/* These combinations meet WCAG AA */
/* Background → Text (contrast ratio) */

#ffffff → #525252  /* 7.0:1 - body text */
#ffffff → #737373  /* 4.6:1 - minimum for small text */
#ffffff → #2563eb  /* 4.8:1 - links */
#2563eb → #ffffff  /* 4.8:1 - primary button */
#1a1a1a → #ffffff  /* 16.1:1 - dark button */
#f5f5f5 → #525252  /* 6.4:1 - muted background */
```

---

## Button Patterns

### HTML/CSS Implementation
```html
<!-- Primary Button -->
<button class="btn btn-primary">
  Get Started
</button>

<!-- Secondary Button -->
<button class="btn btn-secondary">
  Learn More
</button>

<!-- Tertiary Button -->
<button class="btn btn-tertiary">
  Cancel
</button>

<!-- Button with Icon -->
<button class="btn btn-primary">
  <svg class="btn-icon" aria-hidden="true">...</svg>
  <span>Download</span>
</button>
```

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 48px;
  padding: var(--space-3) var(--space-6);
  font-size: 16px;
  font-weight: 600;
  line-height: 1;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
}

.btn-primary {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border: 2px solid transparent;
}
.btn-primary:hover {
  background-color: var(--color-primary-hover);
}
.btn-primary:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.btn-secondary {
  background-color: transparent;
  color: var(--color-primary);
  border: 2px solid var(--color-primary);
}
.btn-secondary:hover {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
}

.btn-tertiary {
  background-color: transparent;
  color: var(--color-primary);
  border: 2px solid transparent;
  padding-inline: var(--space-2);
}
.btn-tertiary:hover {
  background-color: var(--color-bg-secondary);
}

.btn-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}
```

### React/Tailwind Implementation
```jsx
const Button = ({ variant = 'primary', children, icon: Icon, ...props }) => {
  const baseClasses = `
    inline-flex items-center justify-center gap-2
    min-h-[48px] px-6 py-3
    text-base font-semibold
    rounded-lg
    transition-colors duration-150
    focus-visible:outline-2 focus-visible:outline-offset-2
  `;
  
  const variants = {
    primary: `
      bg-blue-600 text-white border-2 border-transparent
      hover:bg-blue-700
      focus-visible:outline-blue-600
    `,
    secondary: `
      bg-transparent text-blue-600 border-2 border-blue-600
      hover:bg-blue-600 hover:text-white
      focus-visible:outline-blue-600
    `,
    tertiary: `
      bg-transparent text-blue-600 border-2 border-transparent
      hover:bg-gray-100
      focus-visible:outline-blue-600
      px-2
    `,
  };

  return (
    <button className={`${baseClasses} ${variants[variant]}`} {...props}>
      {Icon && <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />}
      {children}
    </button>
  );
};
```

---

## Typography System

### Type Scale
```css
:root {
  /* Font sizes */
  --text-xs: 12px;
  --text-sm: 14px;
  --text-base: 16px;
  --text-lg: 18px;
  --text-xl: 20px;
  --text-2xl: 24px;
  --text-3xl: 30px;
  --text-4xl: 36px;
  
  /* Line heights */
  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;
}

/* Headings */
h1 {
  font-size: var(--text-4xl);
  font-weight: 700;
  line-height: var(--leading-tight);
  letter-spacing: -0.02em;
  color: var(--color-text-primary);
}

h2 {
  font-size: var(--text-3xl);
  font-weight: 700;
  line-height: var(--leading-tight);
  letter-spacing: -0.01em;
  color: var(--color-text-primary);
}

h3 {
  font-size: var(--text-2xl);
  font-weight: 600;
  line-height: var(--leading-tight);
  color: var(--color-text-primary);
}

/* Body text */
p, li {
  font-size: var(--text-base);
  font-weight: 400;
  line-height: var(--leading-normal);
  color: var(--color-text-secondary);
}

/* Small text */
.text-small {
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
  color: var(--color-text-tertiary);
}
```

---

## Form Elements

### Input Fields
```css
.input {
  width: 100%;
  min-height: 48px;
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-base);
  color: var(--color-text-primary);
  background-color: var(--color-bg-primary);
  border: 2px solid var(--color-border-default);
  border-radius: var(--radius-md);
  transition: border-color 0.15s;
}

.input:hover {
  border-color: var(--color-border-strong);
}

.input:focus {
  outline: none;
  border-color: var(--color-border-focus);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.input::placeholder {
  color: var(--color-text-disabled);
}

/* Error state */
.input-error {
  border-color: var(--color-error);
}
.input-error:focus {
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
}

/* Label */
.label {
  display: block;
  margin-bottom: var(--space-2);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-primary);
}

/* Helper/Error text */
.helper-text {
  margin-top: var(--space-1);
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
}
.error-text {
  color: var(--color-error);
}
```

---

## Card Components

### Basic Card
```css
.card {
  background-color: var(--color-bg-primary);
  border-radius: var(--radius-lg);
  /* Option A: Border */
  border: 1px solid var(--color-border-default);
  /* Option B: Shadow (choose one) */
  /* box-shadow: 0 1px 3px rgba(0,0,0,0.1); */
}

.card-body {
  padding: var(--space-6);
}

.card-header {
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--color-border-default);
}

.card-footer {
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--color-border-default);
  background-color: var(--color-bg-secondary);
}
```

### Interactive Card (Clickable)
```css
.card-interactive {
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.15s;
}

.card-interactive:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}

.card-interactive:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 2px;
}
```

---

## Navigation Patterns

### Tab Navigation
```css
.tabs {
  display: flex;
  gap: var(--space-1);
  border-bottom: 1px solid var(--color-border-default);
}

.tab {
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--color-text-secondary);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.tab:hover {
  color: var(--color-text-primary);
}

/* Selected state: color + underline (not color alone) */
.tab[aria-selected="true"] {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}
```

### Bottom Navigation (Mobile)
```css
.bottom-nav {
  display: flex;
  justify-content: space-around;
  padding: var(--space-2) 0;
  background-color: var(--color-bg-primary);
  border-top: 1px solid var(--color-border-default);
}

.bottom-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2);
  min-width: 64px;
  color: var(--color-text-secondary);
  text-decoration: none;
}

.bottom-nav-item:hover {
  color: var(--color-text-primary);
}

/* Selected: filled icon + darker text */
.bottom-nav-item[aria-current="page"] {
  color: var(--color-primary);
}

.bottom-nav-icon {
  width: 24px;
  height: 24px;
}

/* Unselected: outline icon */
.bottom-nav-item .bottom-nav-icon {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
}

/* Selected: filled icon */
.bottom-nav-item[aria-current="page"] .bottom-nav-icon {
  fill: currentColor;
  stroke: none;
}

.bottom-nav-label {
  font-size: var(--text-xs);
  font-weight: 500;
}
```

---

## Accessibility Patterns

### Focus Indicators
```css
/* Global focus style */
:focus-visible {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 2px;
}

/* Remove default focus for mouse users */
:focus:not(:focus-visible) {
  outline: none;
}
```

### Skip Link
```html
<a href="#main-content" class="skip-link">
  Skip to main content
</a>
```

```css
.skip-link {
  position: absolute;
  top: -100%;
  left: var(--space-4);
  padding: var(--space-2) var(--space-4);
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border-radius: var(--radius-md);
  z-index: 9999;
}

.skip-link:focus {
  top: var(--space-4);
}
```

### Screen Reader Only
```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

### Icon with Label (Always Provide Text)
```html
<!-- Good: Icon with visible label -->
<button class="btn">
  <svg aria-hidden="true">...</svg>
  <span>Save</span>
</button>

<!-- Acceptable: Icon-only with sr-only label -->
<button class="btn-icon-only">
  <svg aria-hidden="true">...</svg>
  <span class="sr-only">Save</span>
</button>
```
