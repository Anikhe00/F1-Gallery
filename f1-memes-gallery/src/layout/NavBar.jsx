import F1Logo from "../assets/F1Logo.svg";

const NavBar = () => {
  return (
    <header className="px-5 lg:px-16 md:px-10 py-3 border-b-1 border-b-gray-200">
      <div className="flex flex-row gap-1 items-center">
        <img src={F1Logo} alt="Logo" />
        <h1 className="text-3xl font-medium">F1 Gallery</h1>
      </div>
    </header>
  );
};

export default NavBar;
