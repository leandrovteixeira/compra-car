import Link from 'next/link';

interface Props { readonly href: string; readonly className?: string; readonly label?: string }
export function CarbootBackLink({ href, className = '', label = 'Voltar' }: Props) {
  return <Link href={href} aria-label={label}
    className={`inline-flex min-h-9 items-center gap-2 text-sm font-medium text-[#1A1D21] hover:opacity-75 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-[#9ABCC8] ${className}`}>
    <img src="/carboot/back.svg" alt="" aria-hidden="true" className="size-[18px] object-contain"/>
    <span>{label}</span>
  </Link>;
}
