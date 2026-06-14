import Link from "next/link";
import FacebookIcon from "./icons/FacebookIcon";
import InstagramIcon from "./icons/InstagramIcon";
import LinkedInIcon from "./icons/LinkedInIcon";
import TikTokIcon from "./icons/TikTokIcon";
import ModeToggleBar from "./ModeToggleBar";

export default function Navbar() {
  return (
    <div className="w-full border-b border-white/5 bg-[#05030c] p-4">
      <div className="container mx-auto flex items-center justify-between">
        <Link href="/" className="shrink-0">
          <img src="/nectar-logo.png" alt="nectar logo" className="h-8" />
        </Link>

        <ModeToggleBar />

        <div className="flex shrink-0 gap-4">
          <Link
            href="https://www.instagram.com/thenectarapp/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <InstagramIcon />
          </Link>
          <Link
            href="https://www.linkedin.com/company/thenectarapp/?viewAsMember=true"
            target="_blank"
            rel="noopener noreferrer"
          >
            <LinkedInIcon />
          </Link>
          <Link
            href="https://www.tiktok.com/@thenectarapp"
            target="_blank"
            rel="noopener noreferrer"
          >
            <TikTokIcon />
          </Link>
        </div>
      </div>
    </div>
  );
}
