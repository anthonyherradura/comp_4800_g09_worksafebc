import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import AuthProvider from "./auth/AuthProvider";
import Layout from "./components/Layout";
import PublicLayout from "./components/PublicLayout";
import RequireAuth from "./components/RequireAuth";
import LandingPage from "./pages/Landing/Landing";
import LoginPage from "./pages/Login/Login";
import RegisterPage from "./pages/Register/Register";
import HomePage from "./pages/Homepage/Homepage";
import JobsPage from "./pages/Jobs/Jobs";
import PlanningPage from "./pages/Planning/Planning";
import { HazardProvider } from "./context/HazardContext";
import { JobProvider } from "./context/JobContext";
import HazardList from "./pages/Hazard/HazardList";
import HazardAdd from "./pages/Hazard/HazardAdd";
import HazardDetail from "./pages/Hazard/HazardDetail";
import SheetsPage from "./pages/Sheets/SheetsPage";
import PdfsPage from "./pages/Pdfs/PdfsPage";
import HazardSearch from "./pages/Hazard/HazardSearch";

const Placeholder = ({ name }) => (
  <div style={{ padding: 24, fontSize: 20 }}>{name} page</div>
);

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Pages before sign-in: header only, no nav bar */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          {/* Signed-in pages share job/hazard data */}
          <Route
            element={
              <RequireAuth>
                <JobProvider>
                  <HazardProvider>
                    <Outlet />
                  </HazardProvider>
                </JobProvider>
              </RequireAuth>
            }
          >
            {/* Job selection stands on its own: header only, no nav bar. Reached from the header's job button. */}
            <Route element={<Layout showNav={false} />}>
              <Route path="/jobs" element={<JobsPage />} />
            </Route>

            {/* Everything else: header + nav bar */}
            <Route element={<Layout />}>
              <Route path="/home" element={<HomePage />} />
              <Route path="/planning" element={<PlanningPage />} />
              <Route path="/sheets" element={<SheetsPage />} />
              <Route path="/sheets" element={<SheetsPage />} />
              <Route path="/sheets/:sheetId" element={<SheetsPage />} />
              <Route path="/pdfs" element={<PdfsPage />} />
              <Route path="/sheets/:sheetId" element={<SheetsPage />} />
              <Route path="/hazard" element={<HazardList />} />
              <Route path="/hazard/new" element={<HazardAdd />} />
              <Route path="/hazard/search" element={<HazardSearch />} />
              <Route path="/hazard/:id" element={<HazardDetail />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}