const Authlayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="bg-gray-100">
      <div className="flex items-center justify-center px-6 py-8 mx-auto h-screen">
        <div className="flex relative z-10 xl:w-[75%] w-full justify-center">
          {children}
        </div>
      </div>
    </div>
  )
}

export default Authlayout
