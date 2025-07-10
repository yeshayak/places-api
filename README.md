# Places Chrome Extension

A Chrome extension that provides Google Places Autocomplete functionality for Prophet21 forms.

## Setup

### 1. API Key Configuration

1. Copy `src/config.example.ts` to `src/config.ts`
2. Replace `'your_api_key_here'` with your actual Google Maps API key
3. Make sure your API key has the following APIs enabled:
   - Places API
   - Maps JavaScript API

### 2. Build the Extension

```bash
npm run build
```

### 3. Load in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` folder from this project

## Usage

The extension will automatically activate on Prophet21 pages and provide autocomplete functionality for address fields.

## Development

- `npm run build` - Build the extension
- `npm run watch` - Watch for changes and rebuild automatically

## Files

- `src/config.ts` - Contains your API key (not committed to git)
- `src/config.example.ts` - Template for API key configuration
- `src/loadMap.ts` - Handles Google Maps API loading
- `src/autocomplete.ts` - Main autocomplete functionality
