import { useEffect, useRef } from 'react';
import OlMap from 'ol/Map.js';
import View from 'ol/View.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorLayer from 'ol/layer/Vector.js';
import OSM from 'ol/source/OSM.js';
import VectorSource from 'ol/source/Vector.js';
import { fromLonLat } from 'ol/proj.js';
import { Circle, Fill, Stroke, Style, Text } from 'ol/style.js';
import 'ol/ol.css';

const LEIPZIG = fromLonLat([12.3731, 51.3397]);
const STATUS_COLORS = { moving: '#16a34a', idle: '#64748b' };
const SELECTED_RING = '#1d4ed8';
const HIT_TOLERANCE = 6;

// building circle images is the expensive part of a style, so make each variant once
const circles = new Map();

function circle(status, selected) {
  const key = `${status}:${selected}`;
  if (!circles.has(key)) {
    circles.set(
      key,
      new Circle({
        radius: selected ? 10 : 7,
        fill: new Fill({ color: STATUS_COLORS[status] ?? STATUS_COLORS.idle }),
        stroke: new Stroke({
          color: selected ? SELECTED_RING : '#ffffff',
          width: selected ? 3.5 : 2,
        }),
      }),
    );
  }
  return circles.get(key);
}

// getFeatureById calls id.toString(), so it throws for "nothing selected"
function featureById(source, id) {
  return id == null ? null : source.getFeatureById(id);
}

function robotStyle(feature) {
  const selected = feature.get('selected') === true;
  return new Style({
    image: circle(feature.get('status'), selected),
    text: new Text({
      text: feature.get('name'),
      offsetY: selected ? -20 : -16,
      font: `${selected ? 700 : 600} 12px system-ui, sans-serif`,
      fill: new Fill({ color: '#0f172a' }),
      stroke: new Stroke({ color: 'rgba(255, 255, 255, 0.95)', width: 3 }),
    }),
    zIndex: selected ? 1 : 0,
  });
}

export default function RobotMap({ robots, selectedId, onSelect }) {
  const targetRef = useRef(null);
  const mapRef = useRef(null);
  const sourceRef = useRef(null);
  const selectedRef = useRef(null);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // the map is created once; later renders only touch features, never the layers
  useEffect(() => {
    const source = new VectorSource();
    const map = new OlMap({
      target: targetRef.current,
      layers: [
        new TileLayer({ source: new OSM() }),
        new VectorLayer({ source, style: robotStyle }),
      ],
      view: new View({ center: LEIPZIG, zoom: 14 }),
    });

    map.on('singleclick', (e) => {
      const feature = map.forEachFeatureAtPixel(e.pixel, (f) => f, {
        hitTolerance: HIT_TOLERANCE,
      });
      onSelectRef.current(feature ? feature.getId() : null);
    });

    map.on('pointermove', (e) => {
      if (e.dragging) return;
      const hit = map.hasFeatureAtPixel(e.pixel, { hitTolerance: HIT_TOLERANCE });
      map.getTargetElement().style.cursor = hit ? 'pointer' : '';
    });

    mapRef.current = map;
    sourceRef.current = source;
    return () => {
      map.setTarget(undefined);
      map.dispose();
      mapRef.current = null;
      sourceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const source = sourceRef.current;
    for (const r of Object.values(robots)) {
      const coords = fromLonLat([r.lon, r.lat]);
      const feature = source.getFeatureById(r.id);
      if (feature) {
        feature.getGeometry().setCoordinates(coords);
        feature.set('status', r.status);
        continue;
      }
      const created = new Feature({ geometry: new Point(coords), name: r.name, status: r.status });
      created.setId(r.id);
      source.addFeature(created);
    }
  }, [robots]);

  useEffect(() => {
    const source = sourceRef.current;
    featureById(source, selectedRef.current)?.set('selected', false);
    selectedRef.current = selectedId;

    const feature = featureById(source, selectedId);
    if (!feature) return;
    feature.set('selected', true);
    mapRef.current.getView().animate({
      center: feature.getGeometry().getCoordinates(),
      duration: 600,
    });
  }, [selectedId]);

  return <div className="map" ref={targetRef} role="region" aria-label="Robot map" />;
}
