# Places API Chrome Extension

A Chrome extension that integrates Google Places API with Prophet 21 windows for enhanced address functionality.

## Features

- Google Places Autocomplete integration
- Address validation and formatting
- Duplicate address checking
- Support for multiple Prophet 21 windows:
  - Order Entry Sheet
  - Ship To Sheet
  - Customer Maintenance Sheet
  - Customer Master Inquiry
  - Purchase Order Entry Sheet

## Development Setup

### Prerequisites

- Node.js (v22 or higher)
- npm

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Build Commands

- **Production build**: `npm run build`
- **Development with watch**: `npm run watch`
- **Type checking**: `npm run type-check`
- **Clean build**: `npm run clean`

### Development Workflow

1. **Start development mode**:

   ```bash
   npm run watch
   ```

   This will watch TypeScript files and rebuild emitted JavaScript.

2. **Build for production**:

   ```bash
   npm run build
   ```

3. **Load extension in Chrome**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist` folder

## Project Structure

```
src/
├── action-monitor.ts             # P21 action/event monitor
├── address-autocomplete-ui.ts    # Address field discovery and UI hooks
├── address-field-patterns.ts     # Address field matching patterns
├── address-sandbox.ts            # Sandboxed Google Places UI
├── address-sandbox-launcher.ts   # P21 page modal/iframe launcher
├── automation-rules.ts           # Network automation rule definitions
├── background.ts          # Service worker background script
├── content.ts            # Content script for page injection
├── follow-up-requests.ts # Internal P21 follow-up request transport
├── p21-context-monitor.ts # Data context tracking from XHR monitor events
├── p21-data-endpoint.ts  # P21 state, schemas, and field update actions
├── popup.ts              # Extension popup logic
├── xhr-monitor.ts        # XMLHttpRequest watcher
├── w_*.ts                # Prophet 21 window-specific scripts
└── utils/               # Utility functions
    ├── duplicate-check.ts
    ├── load-map.ts
    ├── matcher-utils.ts
    ├── p21-session.ts
    ├── request-parser.ts
    └── user-session.ts
```

## Build Configuration

The project uses `tsc` to emit ES modules into `dist/`, then copies static files from `public/` and rewrites emitted relative imports for Chrome extension runtime loading.

## Deployment

1. Run `npm run build` to create production build
2. The `dist/` folder contains all necessary files
3. Load the extension from the `dist/` folder in Chrome

## Configuration

The extension requires a Google Maps API key to be stored in Chrome's local storage. This can be configured through the extension's popup interface.

## Contributing

1. Make changes to TypeScript files in the `src/` directory
2. Run `npm run watch` for development with auto-rebuild
3. Test changes in Chrome
4. Run `npm run build` before committing

## Troubleshooting

- **Build errors**: Run `npm run type-check` to verify TypeScript compilation
- **Extension not loading**: Check the browser console for errors
- **API issues**: Verify Google Maps API key is properly configured
