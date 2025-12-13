import Image from 'next/image';

export default function MaintenancePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="flex justify-center mb-8">
          <Image
            src="/cryptoart-logo-wgmeets.png"
            alt="Cryptoart Logo"
            width={200}
            height={200}
            className="object-contain"
            priority
          />
        </div>
        <h1 className="text-4xl md:text-6xl font-bold mb-4">
          Cryptoart is down for routine maintenance
        </h1>
        <p className="text-xl md:text-2xl text-gray-400">
          We'll be back shortly. Thank you for your patience.
        </p>
      </div>
    </div>
  );
}


