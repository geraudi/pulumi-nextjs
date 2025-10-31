import Image from "next/image";

export default function Header() {
    return (
        <header className="flex flex-col gap-8 items-center sm:items-start">
            <div className="flex flex-row gap-6">
                <Image
                    className="dark:invert"
                    src="/next.svg"
                    alt="Next.js logo"
                    width={180}
                    height={38}
                    priority
                />
                <p className="text-5xl">+</p>
                <Image src="/open-next-logo.svg" alt="Open Next logo" width={200} height={50} />
                <p className="text-5xl">+</p>
                <Image src="/pulumi-logo.svg" alt="Pulumi logo" width={200} height={50} />
                <p className="text-5xl">+</p>
                <Image src="/aws-logo.svg" alt="AWS logo" width={100} height={40} />
            </div>
        </header>
    );
} 