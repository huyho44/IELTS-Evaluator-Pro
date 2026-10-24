import { useState } from 'react'
import CourseCard from './CourseCard'
import type { Course } from './course'
import { mockCourses } from './mockCourses'

type CourseFilter = 'All' | Course['category'] | 'Enrolled'

const PAGE_SIZE = 6

const filterOptions: CourseFilter[] = [
    'All',
    'Writing Task 1',
    'Writing Task 2',
    'Reading & Listening',
    'Enrolled',
]

export default function CourseCatalogPage() {
    const [search, setSearch] = useState('')
    const [activeFilter, setActiveFilter] = useState<CourseFilter>('All')
    const [page, setPage] = useState(1)

    const enrolledCount = mockCourses.filter((course) => course.enrolled).length
    const keyword = search.trim().toLowerCase()

    const filteredCourses = mockCourses.filter((course) => {
        const searchableText = [
            course.title,
            course.description,
            course.category,
            course.instructorName,
        ]
            .join(' ')
            .toLowerCase()

        const matchesSearch = searchableText.includes(keyword)

        const matchesFilter =
            activeFilter === 'All' ||
            (activeFilter === 'Enrolled'
                ? course.enrolled
                : course.category === activeFilter)

        return matchesSearch && matchesFilter
    })

    const totalPages = Math.ceil(filteredCourses.length / PAGE_SIZE)
    const currentPage = Math.min(page, Math.max(1, totalPages))

    const visibleCourses = filteredCourses.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE,
    )

    function getFilterLabel(filter: CourseFilter) {
        if (filter === 'All') {
            return `All Courses (${mockCourses.length})`
        }

        if (filter === 'Enrolled') {
            return `My Enrolled (${enrolledCount})`
        }

        return filter
    }

    function resetFilters() {
        setSearch('')
        setActiveFilter('All')
        setPage(1)
    }

    return (
        <main className="mx-auto max-w-[1440px] px-6 py-8 lg:px-8">
            <div className="text-center">
                <h1 className="text-3xl font-bold">
                    Explore Preparation Courses
                </h1>

                <p className="mt-3 text-sm leading-6 text-slate-600">
                    Choose focused IELTS lessons and continue your enrolled courses.
                </p>
            </div>

            <div className="mx-auto mt-5 max-w-lg">
                <label htmlFor="course-search" className="sr-only">
                    Search courses
                </label>

                <div className="relative">
                    <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-400"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <circle cx="11" cy="11" r="8" />
                            <path d="m21 21-4.3-4.3" />
                        </svg>
                    </span>

                    <input
                        id="course-search"
                        type="search"
                        value={search}
                        onChange={(event) => {
                            setSearch(event.target.value)
                            setPage(1)
                        }}
                        placeholder="Search by keyword, skill, or instructor..."
                        className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none placeholder:text-slate-500 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                    />
                </div>
            </div>

            <div
                role="group"
                aria-label="Filter courses"
                className="mt-4 flex flex-wrap justify-center gap-2"
            >
                {filterOptions.map((filter) => (
                    <button
                        key={filter}
                        type="button"
                        aria-pressed={activeFilter === filter}
                        onClick={() => {
                            setActiveFilter(filter)
                            setPage(1)
                        }}
                        className={
                            'rounded-full px-4 py-2 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ' +
                            (activeFilter === filter
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200')
                        }
                    >
                        {getFilterLabel(filter)}
                    </button>
                ))}
            </div>

            <section aria-label="Available courses" className="mt-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <p role="status">
                        {filteredCourses.length} courses found
                    </p>

                    <p>Preview with sample course data.</p>
                </div>

                {filteredCourses.length > 0 ? (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                        {visibleCourses.map((course) => (
                            <CourseCard key={course.id} course={course} />
                        ))}
                    </div>
                ) : (
                    <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
                        <h2 className="text-lg font-semibold">
                            No courses found
                        </h2>

                        <p className="mt-2 text-sm text-slate-600">
                            Try a different keyword or course filter.
                        </p>

                        <button
                            type="button"
                            onClick={resetFilters}
                            className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                            Clear filters
                        </button>
                    </div>
                )}

                {totalPages > 1 && (
                    <nav
                        aria-label="Course pagination"
                        className="mt-8 flex flex-wrap items-center justify-center gap-2"
                    >
                        <button
                            type="button"
                            disabled={currentPage === 1}
                            onClick={() => setPage(currentPage - 1)}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            ← Previous
                        </button>

                        {Array.from(
                            { length: totalPages },
                            (_, index) => index + 1,
                        ).map((pageNumber) => (
                            <button
                                key={pageNumber}
                                type="button"
                                aria-current={
                                    currentPage === pageNumber ? 'page' : undefined
                                }
                                onClick={() => setPage(pageNumber)}
                                className={
                                    'rounded-lg px-3 py-2 text-sm font-medium ' +
                                    (currentPage === pageNumber
                                        ? 'bg-blue-600 text-white'
                                        : 'border border-slate-300 bg-white text-slate-700')
                                }
                            >
                                {pageNumber}
                            </button>
                        ))}

                        <button
                            type="button"
                            disabled={currentPage === totalPages}
                            onClick={() => setPage(currentPage + 1)}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Next →
                        </button>
                    </nav>
                )}
            </section>
        </main>
    )
}