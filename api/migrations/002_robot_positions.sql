CREATE TABLE robot_positions (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  robot_id    integer NOT NULL REFERENCES robots (id) ON DELETE CASCADE,
  lat         double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lon         double precision NOT NULL CHECK (lon BETWEEN -180 AND 180),
  status      text NOT NULL CHECK (status IN ('idle', 'moving')),
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX robot_positions_robot_id_recorded_at_idx
  ON robot_positions (robot_id, recorded_at DESC);
