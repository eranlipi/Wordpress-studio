import React from 'react';

export type DeviceType = 'desktop' | 'tablet' | 'mobile';

interface DeviceFrameProps {
  device: DeviceType;
  children: React.ReactNode;
}

const DEVICE_STYLES: Record<DeviceType, { outer: string; inner: string }> = {
  desktop: {
    outer: 'w-full h-full',
    inner: 'w-full h-full',
  },
  tablet: {
    outer: 'flex items-center justify-center h-full bg-gray-100 p-4',
    inner: 'w-[768px] max-w-full h-full rounded-2xl overflow-hidden border-4 border-gray-300 shadow-2xl',
  },
  mobile: {
    outer: 'flex items-center justify-center h-full bg-gray-100 p-4',
    inner: 'w-[390px] max-w-full h-[844px] max-h-full rounded-3xl overflow-hidden border-4 border-gray-300 shadow-2xl',
  },
};

export function DeviceFrame({ device, children }: DeviceFrameProps) {
  const { outer, inner } = DEVICE_STYLES[device];

  return (
    <div className={outer}>
      <div className={inner}>
        {children}
      </div>
    </div>
  );
}
