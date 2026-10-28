import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import CourseCatalogPage from "../features/courses/CourseCatalogPage";
import { catalogFixture } from "../../scripts/fixtures/catalog";
import "../index.css";
const loadFixture = async () => catalogFixture;
if (import.meta.env.DEV) {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BrowserRouter>
        <aside className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-900">
          DEV preview · 14 fixture courses · no API/database requests · course
          links disabled
        </aside>
        <div
          onClick={(event) => {
            if (
              event.target instanceof Element &&
              event.target.closest('a[href^="/courses/"]')
            )
              event.preventDefault();
          }}
        >
          <CourseCatalogPage loadCourses={loadFixture} />
        </div>
      </BrowserRouter>
    </StrictMode>,
  );
}
