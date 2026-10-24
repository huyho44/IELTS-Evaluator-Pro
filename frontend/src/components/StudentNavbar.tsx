import { useEffect, useRef, useState } from 'react'

type StudentNavbarProps = {
    studentName: string
    targetBand?: number | null
}

const navigationItems = [
    'Courses',
    'Practice Tests',
    'Feedback & Homework',
    'My Progress',
]

export default function StudentNavbar({
    studentName,
    targetBand = null,
}: StudentNavbarProps) {
    const [openPanel, setOpenPanel] = useState<
        'account' | 'notifications' | null
    >(null)

    const controlsRef = useRef<HTMLDivElement>(null)
    const accountButtonRef = useRef<HTMLButtonElement>(null)
    const notificationButtonRef = useRef<HTMLButtonElement>(null)

    const initial = studentName.trim().charAt(0).toUpperCase() || '?'

    useEffect(() => {
        if (openPanel === null) return

        function handlePointerDown(event: PointerEvent) {
            if (
                event.target instanceof Node &&
                !controlsRef.current?.contains(event.target)
            ) {
                setOpenPanel(null)
            }
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                setOpenPanel(null)

                if (openPanel === 'account') {
                    accountButtonRef.current?.focus()
                } else {
                    notificationButtonRef.current?.focus()
                }
            }
        }

        document.addEventListener('pointerdown', handlePointerDown)
        document.addEventListener('keydown', handleKeyDown)

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown)
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [openPanel])

    return (
        <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto grid max-w-[1440px] grid-cols-[1fr_auto] items-center gap-x-3 px-4 lg:grid-cols-[1fr_minmax(0,720px)_1fr] lg:px-8">
                <span className="py-5 text-base font-bold text-blue-600 lg:text-lg">
                    IELTS Evaluator Pro
                </span>

                <nav
                    aria-label="Student navigation"
                    className="col-span-2 row-start-2 min-w-0 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:self-stretch"
                >
                    <ul className="flex h-full flex-wrap items-stretch justify-center gap-x-6 sm:gap-x-8">
                        {navigationItems.map((label) => (
                            <li key={label} className="flex">
                                <span
                                    aria-current={label === 'Courses' ? 'page' : undefined}
                                    className={
                                        'relative flex min-h-14 items-center py-3 text-sm font-medium ' +
                                        (label === 'Courses'
                                            ? 'text-blue-600'
                                            : 'text-slate-600')
                                    }
                                >
                                    {label}

                                    {label === 'Courses' && (
                                        <span
                                            aria-hidden="true"
                                            className="absolute inset-x-0 -bottom-[3px] z-10 h-[3px] rounded-full bg-blue-600"
                                        />
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>
                </nav>

                <div
                    ref={controlsRef}
                    className="relative col-start-2 row-start-1 flex min-w-0 items-center justify-self-end gap-2 lg:col-start-3"
                >
                    <button
                        ref={notificationButtonRef}
                        type="button"
                        aria-label="Notifications"
                        aria-expanded={openPanel === 'notifications'}
                        aria-controls="student-notifications"
                        onClick={() =>
                            setOpenPanel((previous) =>
                                previous === 'notifications' ? null : 'notifications',
                            )
                        }
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                            <path d="M10 21h4" />
                        </svg>
                    </button>

                    <button
                        ref={accountButtonRef}
                        type="button"
                        aria-label={`Account: ${studentName}`}
                        aria-expanded={openPanel === 'account'}
                        aria-controls="student-account"
                        onClick={() =>
                            setOpenPanel((previous) =>
                                previous === 'account' ? null : 'account',
                            )
                        }
                        className="flex min-w-0 items-center gap-2.5 rounded-full border border-slate-200 bg-slate-50 p-1.5 sm:pr-3 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                        <span
                            aria-hidden="true"
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700"
                        >
                            {initial}
                        </span>

                        <span className="hidden min-w-0 flex-col items-start sm:flex">
                            <span className="max-w-28 truncate text-sm font-semibold leading-5 text-slate-900">
                                {studentName}
                            </span>

                            <span className="whitespace-nowrap text-[11px] font-semibold leading-4 text-blue-600">
                                {targetBand === null
                                    ? 'Target not set'
                                    : `Target ${targetBand.toFixed(1)}`}
                            </span>
                        </span>

                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                            className={
                                'shrink-0 text-slate-500 transition-transform ' +
                                (openPanel === 'account' ? 'rotate-180' : '')
                            }
                        >
                            <path d="m6 9 6 6 6-6" />
                        </svg>
                    </button>

                    {openPanel === 'notifications' && (
                        <section
                            id="student-notifications"
                            aria-label="Notifications"
                            className="absolute right-0 top-full z-30 mt-3 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-4 shadow-lg"
                        >
                            <h2 className="text-sm font-semibold">Notifications</h2>

                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                Notifications are not connected yet.
                            </p>
                        </section>
                    )}

                    {openPanel === 'account' && (
                        <section
                            id="student-account"
                            aria-label="Account details"
                            className="absolute right-0 top-full z-30 mt-3 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-4 shadow-lg"
                        >
                            <p className="font-semibold">{studentName}</p>

                            <p className="mt-1 text-sm text-slate-600">
                                Target band:{' '}
                                {targetBand === null
                                    ? 'Not set'
                                    : targetBand.toFixed(1)}
                            </p>

                            <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">
                                Profile and logout will be connected with authentication.
                            </p>
                        </section>
                    )}
                </div>
            </div>
        </header>
    )
}