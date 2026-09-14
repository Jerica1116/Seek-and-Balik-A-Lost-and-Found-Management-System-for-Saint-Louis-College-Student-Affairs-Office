import slcLogo from "../assets/slc-logo.png";
import saoLogo from "../assets/sao.png";
import seekBalikLogo from "../assets/seek-balik-logo.jpg";

const Header = ({
  variant = "public",
  time,
  date,
  onOpenLogin,
  showLogin = false,
  rightContent,
  onLogoClick,
}) => {
  return (
    <header className="w-full bg-[#005F86] border-b border-white/10 px-4 sm:px-5 lg:px-6 py-2 sm:py-3 flex flex-col md:flex-row md:justify-between md:items-center gap-4">

  <div className="flex items-center gap-3 sm:gap-4 min-w-0">

    <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
      <img
        src={slcLogo}
        alt="SLC Logo"
        onClick={onLogoClick}
        className={`w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 object-contain ${
          onLogoClick ? "cursor-pointer hover:opacity-80 transition-opacity" : ""
        }`}
      />

  
      <img
        src={saoLogo}
        alt="SAO Logo"
        className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 object-contain rounded-full"
      />
    </div>

    <div className="leading-tight min-w-0">
      <h1 className="text-white text-2xl sm:text-3xl lg:text-4xl font-normal font-old-english leading-none">
        Saint Louis College
      </h1>

      <p className="text-white text-xs sm:text-sm lg:text-base mt-1">
        Seek & Balik: A Lost and Found Management System
      </p>
    </div>

  </div>

  {variant === "dashboard" ? (
    <div className="flex md:flex-col items-start md:items-end justify-between md:justify-center text-white md:mr-8 border-t border-white/15 md:border-t-0 pt-3 md:pt-0 w-full md:w-auto">
      <p className="text-lg sm:text-xl lg:text-2xl font-bold font-mono">
        {time}
      </p>

      <p className="text-xs uppercase opacity-70">
        {date}
      </p>
    </div>
  ) : (
    <div className="w-full md:w-auto flex justify-start md:justify-end border-t border-white/15 md:border-t-0 pt-3 md:pt-0">
      {rightContent}

      {!rightContent && showLogin && (
        <button
          onClick={onOpenLogin}
          className="w-full sm:w-auto px-6 py-2 full border border-white/40 bg-white/10 hover:bg-white/20 text-white transition"
        >
          Login
        </button>
      )}
    </div>
  )}
</header>
  );
};

export default Header;