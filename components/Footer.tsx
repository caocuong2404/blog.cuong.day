/* eslint-disable react/jsx-no-target-blank */
import { IoMoonSharp } from '@react-icons/all-files/io5/IoMoonSharp'
import { IoSunnyOutline } from '@react-icons/all-files/io5/IoSunnyOutline'
import * as React from 'react'

import * as config from '@/lib/config'
import { socialLinks } from '@/lib/social-links'
import { useDarkMode } from '@/lib/use-dark-mode'

import styles from './styles.module.css'

// TODO: merge the data and icons from PageSocial with the social links in Footer

export function FooterImpl() {
  const [hasMounted, setHasMounted] = React.useState(false)
  const { isDarkMode, toggleDarkMode } = useDarkMode()
  const currentYear = new Date().getFullYear()

  const onToggleDarkMode = React.useCallback(
    (e) => {
      e.preventDefault()
      toggleDarkMode()
    },
    [toggleDarkMode]
  )

  React.useEffect(() => {
    setHasMounted(true)
  }, [])

  return (
    <footer className={styles.footer}>
      <div className={styles.copyright}>
        Copyright {currentYear} {config.author}
      </div>

      <div className={styles.settings}>
        {hasMounted && (
          <button
            type='button'
            className={styles.toggleDarkMode}
            onClick={onToggleDarkMode}
            aria-label='Toggle dark mode'
          >
            {isDarkMode ? <IoMoonSharp /> : <IoSunnyOutline />}
          </button>
        )}
      </div>

      <div className={styles.social}>
        {socialLinks.map((link) => (
          <a
            key={link.name}
            className={styles[link.name]}
            href={link.href}
            title={link.title}
            aria-label={link.title}
            target='_blank'
            rel={link.rel}
          >
            {link.icon}
          </a>
        ))}
      </div>
    </footer>
  )
}

export const Footer = React.memo(FooterImpl)
