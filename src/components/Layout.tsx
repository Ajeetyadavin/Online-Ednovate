import { Outlet } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import MobileStickyFooter from "./MobileStickyFooter";
import FloatingContact from "./FloatingContact";

const Layout = () => {
  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <Header />
      <Outlet />
      <Footer />
      <MobileStickyFooter />
      <FloatingContact />
    </div>
  );
};

export default Layout;
