/* eslint-disable react/jsx-no-target-blank */
import type * as React from 'react'
import cs from 'classnames'

import { type SocialLink, socialLinks } from '@/lib/social-links'

import styles from './PageSocial.module.css'

export function PageSocial() {
  return (
    <div className={styles.pageSocial}>
      {socialLinks.map((action: SocialLink) => (
        <a
          className={cs(styles.action, styles[action.name])}
          href={action.href}
          key={action.name}
          title={action.title}
          aria-label={action.title}
          target='_blank'
          rel={action.rel}
        >
          <div className={styles.actionBg}>
            <div className={styles.actionBgPane} />
          </div>

          <div className={styles.actionBg}>{action.icon}</div>
        </a>
      ))}
    </div>
  )
}
