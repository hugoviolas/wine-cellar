export interface RegionInputProps {
  readonly value: string;
  readonly subRegion: string;
  readonly onChange: (value: string) => void;
  readonly onSubRegionChange: (value: string) => void;
}
