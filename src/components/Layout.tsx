import { Outlet } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import MobileStickyFooter from "./MobileStickyFooter";

const Layout = () => {
  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0 overflow-x-hidden">
      <Header />
      <Outlet />
      <Footer />
      <MobileStickyFooter />
    </div>
  );
};

export default Layout;
