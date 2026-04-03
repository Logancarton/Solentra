// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { JSX } from 'react';

export interface LogoProps {
  readonly size: number;
  readonly fill?: string;
}

export function Logo(props: LogoProps): JSX.Element {
  const overrideUrl = import.meta.env.MEDPLUM_LOGO_URL;
  if (overrideUrl) {
    return <img src={overrideUrl} alt="Solentra" style={{ maxHeight: props.size }} />;
  }
  const fill = props.fill ?? '#0f6cbd';
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 40" style={{ width: props.size * 5, height: props.size }}>
      <title>Solentra</title>
      <circle cx="20" cy="20" r="18" fill={fill} />
      <text x="20" y="26" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold" fontFamily="Arial, sans-serif">S</text>
      <text x="48" y="28" fill={fill} fontSize="22" fontWeight="700" fontFamily="Arial, sans-serif">solentra</text>
    </svg>
  );
}
