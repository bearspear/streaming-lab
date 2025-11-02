# Media Streaming Frontend

Netflix-style Angular frontend for the Media Streaming Server.

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 17.3.17.

## Quick Start

### Prerequisites
- Node.js 18+ installed
- Backend server running on http://localhost:4000

### Installation

```bash
npm install
```

### Development Server

```bash
npm start
# or
ng serve
```

Navigate to `http://localhost:4200/`

### Build for Production

```bash
npm run build
# or
ng build
```

The build artifacts will be stored in the `dist/` directory.

## Project Structure

See `PHASE-5-IMPLEMENTATION-GUIDE.md` for complete implementation details and architecture.

## Key Features

- ✅ User Authentication (Login/Register)
- ✅ Video Player with HLS streaming support
- ✅ Netflix-style Library Grid
- ✅ Continue Watching feature
- ✅ Watch Progress Tracking
- ✅ Media Details pages
- ✅ Responsive Design
- ✅ Protected Routes

## Technology Stack

- **Framework**: Angular 17 (Standalone Components)
- **Styling**: SCSS with Netflix-inspired theme
- **Video Player**: Video.js with HLS support (hls.js)
- **HTTP Client**: Angular HttpClient
- **Routing**: Angular Router with lazy loading
- **State Management**: Services with RxJS

## API Configuration

Backend API URL is configured in `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:4000/api'
};
```

## Implementation Status

**Phase 5 Progress**: Implementation Guide Created ✅

The project structure has been set up with:
- Angular 17 project initialized
- Video.js and HLS dependencies installed
- Environment configuration created
- Implementation guide completed

### Next Steps

Follow the `PHASE-5-IMPLEMENTATION-GUIDE.md` to implement:

1. Core services (Auth, Media, Watch History)
2. Auth Guard and HTTP Interceptor
3. Components (Library Grid, Video Player, Media Details)
4. Routing configuration
5. Netflix-style theming
6. User interface components

## Running Tests

```bash
npm test
# or
ng test
```

## Code Scaffolding

Generate new components:
```bash
ng generate component component-name
```

You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Further Help

- **Implementation Guide**: See `PHASE-5-IMPLEMENTATION-GUIDE.md`
- **Angular CLI**: `ng help` or https://angular.io/cli
- **Video.js Docs**: https://videojs.com/
- **Backend API**: http://localhost:4000/api

## License

ISC
