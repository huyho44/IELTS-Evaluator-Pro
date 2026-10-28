import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../session';
export default function PrivateRoute({ allowedRoles }: { allowedRoles?: string[] }) {
 const { session, restoring } = useSession(); const location = useLocation();
 if (restoring) return <p role="status">Restoring session...</p>;
 if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search + location.hash }} />;
 if (allowedRoles && !allowedRoles.some(role => session.user.roles.includes(role))) return (
   <main className="mx-auto max-w-[1440px] px-4 py-12 sm:px-8">
     <div role="alert" className="rounded-xl border border-red-200 bg-white p-6 text-sm text-red-700">
       You do not have access to this page.
     </div>
   </main>
 );
 return <Outlet />;
}
