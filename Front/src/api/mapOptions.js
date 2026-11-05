export const mapStyleId = process.env.REACT_APP_NAVER_MAP_STYLE_ID || '';

export function mapOptions(maps) {
  return {
    ...(mapStyleId ? { gl: true, customStyleId: mapStyleId } : {
      mapTypeId: 'normal',
      mapTypes: new maps.MapTypeRegistry({
        normal: maps.NaverStyleMapTypeOptions.getNormalMap({ overlayType: 'bg.ol' })
      })
    }),
    logoControl: true,
    mapDataControl: true
  };
}
