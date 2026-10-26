import StudentNavbar from './components/StudentNavbar'
import CourseCatalogPage from './features/courses/CourseCatalogPage'

export default function App() {
  return (
    <>
      <StudentNavbar studentName="Hải" targetBand={7.0} />
      <CourseCatalogPage />
    </>
  )
}