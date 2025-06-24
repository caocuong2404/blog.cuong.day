import type { ReactNode } from 'react'
import { FaEnvelopeOpenText } from '@react-icons/all-files/fa/FaEnvelopeOpenText'
import { FaGithub } from '@react-icons/all-files/fa/FaGithub'
import { FaLinkedin } from '@react-icons/all-files/fa/FaLinkedin'
import { FaMastodon } from '@react-icons/all-files/fa/FaMastodon'
import { FaTwitter } from '@react-icons/all-files/fa/FaTwitter'
import { FaYoutube } from '@react-icons/all-files/fa/FaYoutube'
import { FaZhihu } from '@react-icons/all-files/fa/FaZhihu'

import * as config from '@/lib/config'

export interface SocialLink {
  name: string
  title: string
  href: string
  icon: ReactNode
  rel?: string
}

export const socialLinks: SocialLink[] = [
  config.twitter && {
    name: 'twitter',
    href: `https://twitter.com/${config.twitter}`,
    title: `Twitter @${config.twitter}`,
    icon: <FaTwitter />,
    rel: 'noopener noreferrer'
  },
  config.mastodon && {
    name: 'mastodon',
    href: config.mastodon,
    title: `Mastodon ${config.getMastodonHandle()}`,
    icon: <FaMastodon />,
    rel: 'me noopener noreferrer'
  },
  config.zhihu && {
    name: 'zhihu',
    href: `https://zhihu.com/people/${config.zhihu}`,
    title: `Zhihu @${config.zhihu}`,
    icon: <FaZhihu />,
    rel: 'noopener noreferrer'
  },
  config.github && {
    name: 'github',
    href: `https://github.com/${config.github}`,
    title: `GitHub @${config.github}`,
    icon: <FaGithub />,
    rel: 'noopener noreferrer'
  },
  config.linkedin && {
    name: 'linkedin',
    href: `https://www.linkedin.com/in/${config.linkedin}`,
    title: `LinkedIn ${config.author}`,
    icon: <FaLinkedin />,
    rel: 'noopener noreferrer'
  },
  config.newsletter && {
    name: 'newsletter',
    href: `${config.newsletter}`,
    title: `Newsletter ${config.author}`,
    icon: <FaEnvelopeOpenText />,
    rel: 'noopener noreferrer'
  },
  config.youtube && {
    name: 'youtube',
    href: `https://www.youtube.com/${config.youtube}`,
    title: `YouTube ${config.author}`,
    icon: <FaYoutube />,
    rel: 'noopener noreferrer'
  }
].filter(Boolean) as SocialLink[]
