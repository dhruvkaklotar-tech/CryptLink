// ===================
// CryptLink Engineering | 2026
// App.tsx
// ===================
import { Route } from "@solidjs/router";
import { type Component, lazy } from "solid-js";

const Home = lazy(() => import("./pages/Home"));
const Register = lazy(() => import("./pages/Register"));
const Login = lazy(() => import("./pages/Login"));
const Chat = lazy(() => import("./pages/Chat"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));

const App: Component = () => {
  return (
    <>
      <Route path="/" component={Home} />
      <Route path="/register" component={Register} />
      <Route path="/login" component={Login} />
      <Route path="/chat" component={Chat} />
      <Route path="/settings" component={Settings} />
      <Route path="*" component={NotFound} />
    </>
  );
};

export default App;
