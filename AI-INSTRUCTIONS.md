# VibePlanner AI Assistant Instructions

## Project Overview
VibePlanner is a comprehensive architectural project management application built with Next.js, Convex, Clerk, and TypeScript.

## Architecture Stack
- **Frontend**: Next.js 15, React 19, TypeScript
- **Backend**: Convex (database + server functions)
- **Auth**: Clerk (organizations + users)
- **Styling**: Tailwind CSS, Radix UI components
- **Rich Text**: Tiptap editor
- **AI**: OpenAI integration (@ai-sdk/openai)
- **File Storage**: AWS S3 + R2 storage
- **Package Manager**: pnpm

## Core Entities & Relationships

### Teams (Organizations)
- Mapped to Clerk Organizations
- Have unique slug for routing
- Contain task status settings
- Manage members and permissions

### Projects
- Belong to Teams
- Have numeric ID for users + slug
- Statuses: planning, active, on_hold, completed, cancelled
- Support budget in different currencies (USD, EUR, PLN)
- Have configured sidebar permissions
- AI integration (indexing, RAG)

### Tasks
- Belong to Projects and Teams
- 4 statuses: todo, in_progress, review, done (customizable)
- Rich text content (Tiptap)
- Priorities: low, medium, high, urgent
- Start, end, deadline dates
- Costs and tags

### Files & Folders
- File system with folder hierarchy
- Support for different types: image, video, document, drawing, model, other
- Storage in R2/S3
- Text extraction (OCR for images, parsing for PDF)
- File versioning

### Chat System
- Channels at Teams and Projects level
- Messages with file and reply support
- Channel membership system
- Unread message marking

### Survey System
- Surveys for clients/team members
- Different question types: text, multiple choice, rating, file upload
- Response and analytics management

### Shopping Lists
- Shopping sections and items
- Implementation statuses: PLANNED → ORDERED → IN_TRANSIT → DELIVERED → COMPLETED
- Product details: supplier, catalog number, dimensions, prices

## Development Guidelines

### File Structure Conventions
```
app/[slug]/                    # Team routing
app/[slug]/[projectSlug]/      # Project routing
components/                    # Shared components
convex/                       # Backend functions & schema
```

### Code Standards
- Always check existing patterns before adding new code
- Use existing UI components from `/components/ui/`
- Check schema.ts to understand data structure
- Use Convex functions for backend operations

### Database Operations
- All operations through Convex functions
- Check existing functions in `/convex/` before creating new ones
- Use appropriate indexes defined in schema
- Clerk user ID as user identifier

### UI/UX Patterns
- Radix UI components as foundation
- Tailwind CSS for styling
- Form handling with react-hook-form + zod validation
- Breadcrumbs for project navigation
- Sidebar permissions system

### AI Integration
- RAG system for projects (`/convex/rag.ts`)
- Text extraction from files (`/convex/textExtraction.ts`)
- AI chat threads for assistant
- Project content indexing

### Authentication & Authorization
- Clerk Organizations = Teams
- Role-based permissions (admin, member, customer)
- Customers have access only to assigned projects
- Check permissions in every operation

### Testing & Quality
- Run `npm run lint` before commit
- TypeScript strict mode
- Check for console errors

## Common Patterns

### Creating New Features
1. Check schema.ts if new tables are needed
2. Create Convex functions in appropriate file
3. Add UI components in `/components/`
4. Integrate with routing in `/app/`
5. Add breadcrumbs and navigation

### File Operations
- Use `/convex/files.ts` functions
- Handle text extraction for documents
- Check file permissions before operations

### Chat Features
- Use existing channel system
- Handle real-time updates
- Check channel membership

### Customer Management
- Distinguish team members from clients
- Clients have limited access to projects
- Use invitation system



## Important Notes
- Project uses English comments in schema and code
- All dates stored as timestamps (number)
- Clerk user IDs as string identifiers
- Convex IDs for table relationships
- Responsive design for mobile/desktop
- Real-time updates through Convex subscriptions

## AI Assistant Behavior
- Always analyze existing code before adding new
- Check if functionality already exists
- Use existing components and patterns
- Add comments in English for consistency
- Maintain consistency with existing code style
- Test changes locally before committing