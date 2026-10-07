import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import ProtectedRoute from "./components/routing/ProtectedRoute";
import Login from "./pages/Login";
import Invitation from "./pages/Invitation";
import Dashboard from "./pages/Dashboard";
import Calendar from "./pages/Calendar";
import Finance from "./pages/Finance";
import People from "./pages/People";
import Groups from "./pages/Groups";
import GroupDetails from "./pages/GroupDetails";
import Inventory from "./pages/Inventory";
import EmailList from "./pages/EmailList";
import Settings from "./pages/Settings";
import Forms from "./pages/Forms";
import FormEditor from "./pages/FormEditor";
import FormSubmissions from "./pages/FormSubmissions";
import PublicForm from "./pages/PublicForm";
import Volunteers from "./pages/Volunteers";
import VolunteerSignupEditor from "./pages/VolunteerSignupEditor";
import VolunteerDetails from "./pages/VolunteerDetails";
import PublicVolunteer from "./pages/PublicVolunteer";
import Announcements from "./pages/Announcements";
import Saved from "./pages/Saved";
import SavedDetails from "./pages/SavedDetails";
import FeatureUnavailable from "./pages/FeatureUnavailable";
import NotFound from "./pages/NotFound";
import { FINANCE_ENABLED } from "./lib/features";

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />
      <Route path="/invite/:token" element={<Invitation />} />
      <Route path="/form/:slug" element={<PublicForm />} />
      <Route path="/volunteer/:id" element={<PublicVolunteer />} />

      {/* Leaders only */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/finance" element={FINANCE_ENABLED ? <Finance /> : <FeatureUnavailable title="Finance" />} />
          <Route path="/people" element={<People />} />
          <Route path="/people/members" element={<People membersOnly />} />
          <Route path="/people/groups" element={<Groups />} />
          <Route path="/people/groups/:id" element={<GroupDetails />} />
          <Route path="/members" element={<Navigate to="/people" replace />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/saved" element={<Saved />} />
          <Route path="/saved/:id" element={<SavedDetails />} />
          <Route path="/forms" element={<Forms />} />
          <Route path="/forms/new" element={<FormEditor />} />
          <Route path="/forms/:slug/edit" element={<FormEditor />} />
          <Route path="/forms/:slug/submissions" element={<FormSubmissions />} />
          <Route path="/volunteers" element={<Volunteers />} />
          <Route path="/volunteers/new" element={<VolunteerSignupEditor />} />
          <Route path="/volunteers/:id" element={<VolunteerDetails />} />
          <Route path="/volunteers/:id/edit" element={<VolunteerSignupEditor />} />
          <Route path="/volunteer" element={<Navigate to="/volunteers" replace />} />
          <Route path="/announcements" element={<Announcements />} />
          <Route path="/email-list" element={<EmailList />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
