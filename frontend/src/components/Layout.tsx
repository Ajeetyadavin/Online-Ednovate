import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import MobileStickyFooter from "./MobileStickyFooter";
import FloatingContact from "./FloatingContact";
import MarketingPopupEngine from "./MarketingPopupEngine";

const Layout = () => {
  const location = useLocation();
  const isLmsRoute = location.pathname.startsWith("/learn/");

  return (
    <div className={`min-h-screen bg-background ${isLmsRoute ? "pb-0" : "pb-24 md:pb-0"}`}>
      <Header />
      <Outlet />
      {!isLmsRoute && <Footer />}
      {!isLmsRoute && <MobileStickyFooter />}
      {!isLmsRoute && <FloatingContact />}
      <MarketingPopupEngine />
    </div>
  );
};

export default Layout;
