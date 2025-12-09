# AI Studio Application Rules

This document outlines the technical stack and guidelines for developing features within this application. Adhering to these rules ensures consistency, maintainability, and leverages the strengths of our chosen technologies.

## Tech Stack Overview

1.  **React**: The primary library for building the user interface.
2.  **TypeScript**: All application code is written in TypeScript for type safety and improved developer experience.
3.  **Tailwind CSS**: Used exclusively for styling components, providing a utility-first approach to design.
4.  **Vite**: The build tool for a fast development experience and optimized production builds.
5.  **Google Gemini API (`@google/genai`)**: Integrated for all AI-powered features, including text translation, summarization, and conversational AI.
6.  **React Router**: Used for client-side routing to manage different views and navigation within the application.
7.  **shadcn/ui**: A collection of re-usable components built with Radix UI and Tailwind CSS, providing accessible and customizable UI elements.
8.  **Radix UI**: Provides unstyled, accessible components that serve as the foundation for shadcn/ui and custom components requiring advanced accessibility features.
9.  **Lucide React**: Utilized for all icons throughout the application.

## Library Usage Guidelines

*   **UI Development**:
    *   Always use **React** with **TypeScript** for all components and pages.
    *   New components should be created in `src/components/` and pages in `src/pages/`.
*   **Styling**:
    *   **Tailwind CSS** is the sole styling framework. Avoid inline styles or separate CSS files unless absolutely necessary for third-party integrations that cannot be overridden.
    *   Ensure designs are responsive using Tailwind's utility classes.
*   **AI Integration**:
    *   All interactions with AI models must go through the `@google/genai` library, as demonstrated in `services/geminiService.ts`.
    *   API keys should be handled securely, as currently implemented (e.g., via cookies or environment variables).
*   **Routing**:
    *   Manage all application routes using **React Router**. Keep route definitions centralized, ideally within `src/App.tsx`.
*   **Components**:
    *   Prioritize using components from **shadcn/ui** for common UI elements (buttons, inputs, dialogs, etc.).
    *   If a specific component is not available in shadcn/ui or requires significant customization, create a new custom component using **Radix UI** primitives for accessibility and style it with **Tailwind CSS**.
    *   Avoid modifying shadcn/ui component files directly; instead, wrap them or create new components that compose them.
*   **Icons**:
    *   Use icons from the **lucide-react** library.
*   **State Management**:
    *   For local component state, use React's `useState` and `useReducer` hooks. For global or shared state, consider React Context API or a lightweight state management solution if complexity increases.
*   **Utility Functions**:
    *   Create small, focused utility files (e.g., `src/utils/toast.ts`) for common functionalities.