const Main = ({ children }) => {
  return (
    <div className="w-full h-full flex flex-col px-5 lg:px-16 md:px-10 py-16 overflow-scroll scroll-auto">
      {children}
    </div>
  );
};

export default Main;
