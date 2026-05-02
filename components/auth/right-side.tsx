import Image from 'next/image'

export const RightSide = () => {
  return (
    <div className="xl:block lg:block w-96 relative bg-white text-white overflow-hidden rounded-tr-[2.5rem] rounded-br-[2.5rem]">
      <div className="absolute inset-0 bg-linear-to-t from-black via-transparent to-transparent opacity-70 z-10 rounded-tr-3xl rounded-br-3xl"></div>
      <Image src="/login-image-2.jpg" alt='Login Image' fill objectPosition='top' quality={100} objectFit='cover' className='z-10 absolute w-fit h-[100%] bg-cover' loading='lazy'/>
    </div>
  )
}