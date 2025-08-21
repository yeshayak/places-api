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

- Node.js (v16 or higher)
- npm

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Build Commands

- **Development build**: `npm run build:dev`
- **Production build**: `npm run build`
- **Development with watch**: `npm run dev`
- **Type checking**: `npm run type-check`
- **Clean build**: `npm run clean`

### Development Workflow

1. **Start development mode**:

   ```bash
   npm run dev
   ```

   This will watch for file changes and rebuild automatically.

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
├── background.ts          # Service worker background script
├── content.ts            # Content script for page injection
├── loadMap.ts            # Google Maps API loader
├── popup.ts              # Extension popup logic
├── autocomplete.ts       # Places Autocomplete functionality
├── w_*.ts               # Prophet 21 window-specific scripts
└── utils/               # Utility functions
    ├── duplicateCheck.ts
    └── userSession.ts
```

## Build Configuration

The project uses **Webpack** as the bundler with the following features:

- **TypeScript compilation** with ts-loader
- **Multiple entry points** for different extension components
- **Asset copying** for static files (HTML, CSS, images)
- **Source maps** for debugging
- **Code optimization** for production builds

### Webpack Configuration Files

- `webpack.config.js` - Base configuration
- `webpack.dev.js` - Development-specific overrides

## Deployment

1. Run `npm run build` to create production build
2. The `dist/` folder contains all necessary files
3. Load the extension from the `dist/` folder in Chrome

## Configuration

The extension requires a Google Maps API key to be stored in Chrome's local storage. This can be configured through the extension's popup interface.

## Contributing

1. Make changes to TypeScript files in the `src/` directory
2. Run `npm run dev` for development with auto-rebuild
3. Test changes in Chrome
4. Run `npm run build` before committing

## Troubleshooting

- **Build errors**: Run `npm run type-check` to verify TypeScript compilation
- **Extension not loading**: Check the browser console for errors
- **API issues**: Verify Google Maps API key is properly configured
