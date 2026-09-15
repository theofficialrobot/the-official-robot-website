const HUMANOID_SPEC_GROUPS = [
  { name: 'General', keys: ['Type','Manufacturer','Model','Model Year','Origin','Status','Primary Use'] },
  { name: 'Dimensions & weight', keys: ['Height','Weight','Standing Envelope'] },
  { name: 'Performance', keys: ['Degrees of Freedom','Max Speed','Walking Speed','Payload','Rise After Fall'] },
  { name: 'Power', keys: ['Battery / Runtime','Charging'] },
  { name: 'Manipulation', keys: ['Hands / End-effectors','Hand DOF','Number of Fingers','Manipulation Score'] },
  { name: 'Sensing', keys: ['Camera / Vision','Camera Resolution','Video','Audio','LiDAR','Sensors','Tactile / Force Sensors'] },
  { name: 'Compute & software', keys: ['Compute','CPU / GPU','Operating System','LLM Integration','Connectivity','Control Interface','Navigation','Navigation Score'] },
  { name: 'Mechanical', keys: ['Motor Tech','Gear Tech','Main Structural Material','IP Rating','Safe with Humans'] },
  { name: 'Commercial', keys: ['List Price','Warranty (std)','Best Fit'] }
];

const CAMPANIONOID_SPEC_GROUPS = [
  { name: 'General', keys: ['Type','Manufacturer','Model','Model Year','Origin','Status','Primary Use'] },
  { name: 'Dimensions & weight', keys: ['Standing Size','Height','Weight'] },
  { name: 'Performance', keys: ['Degrees of Freedom','Max Speed','Payload'] },
  { name: 'Power', keys: ['Battery / Runtime','Charging'] },
  { name: 'Sensing', keys: ['Camera / Vision','Video','LiDAR','Sensors','Obstacle Sensing'] },
  { name: 'Compute & software', keys: ['Compute','Connectivity','Control Interface','Navigation'] },
  { name: 'Mechanical', keys: ['Motor Tech','IP Rating','Operating Environment'] },
  { name: 'Commercial', keys: ['List Price','Warranty (std)','Best Fit'] }
];

const AERIAL_SPEC_GROUPS = [
  { name: 'General', keys: ['Type','Manufacturer','Model','Model Year','Origin','Status','Primary Use'] },
  { name: 'Dimensions & weight', keys: ['Weight','Size / Envelope'] },
  { name: 'Performance', keys: ['Max Speed','Flight Time','Range / Link','Payload'] },
  { name: 'Power', keys: ['Battery / Runtime','Charging'] },
  { name: 'Sensing', keys: ['Camera / Vision','Video','Gimbal','Obstacle Sensing'] },
  { name: 'Compute & software', keys: ['Compute','Connectivity','Control Interface'] },
  { name: 'Mechanical', keys: ['IP Rating','Operating Environment'] },
  { name: 'Commercial', keys: ['List Price','Warranty (std)','Best Fit'] }
];

const WATER_SPEC_GROUPS = [
  { name: 'General', keys: ['Type','Manufacturer','Model','Model Year','Origin','Status','Primary Use'] },
  { name: 'Dimensions & weight', keys: ['Weight','Size / Envelope'] },
  { name: 'Performance', keys: ['Depth Rating','Payload','Max Speed'] },
  { name: 'Power', keys: ['Battery / Runtime','Charging'] },
  { name: 'Sensing', keys: ['Camera / Vision','Video','Lights','Sensors'] },
  { name: 'Propulsion', keys: ['Thrusters','Tether','Range / Link'] },
  { name: 'Compute & software', keys: ['Control Interface','Connectivity','Navigation'] },
  { name: 'Mechanical', keys: ['IP Rating','Operating Environment'] },
  { name: 'Commercial', keys: ['List Price','Warranty (std)','Best Fit'] }
];

const HAND_SPEC_GROUPS = [
  { name: 'General', keys: ['Type','Manufacturer','Model','Model Year','Origin','Status','Primary Use'] },
  { name: 'Dimensions & weight', keys: ['Weight','Size','Envelope'] },
  { name: 'Performance', keys: ['Degrees of Freedom','Fingers','Payload','Strength'] },
  { name: 'Sensing', keys: ['Tactile / Force Sensors'] },
  { name: 'Mechanical', keys: ['Motor Tech','Structure'] },
  { name: 'Commercial', keys: ['List Price','Warranty (std)','Best Fit'] }
];

const TYPE_SPEC_GROUPS = {
  humanoid: HUMANOID_SPEC_GROUPS,
  campanionoid: CAMPANIONOID_SPEC_GROUPS,
  aerial: AERIAL_SPEC_GROUPS,
  water: WATER_SPEC_GROUPS,
  hand: HAND_SPEC_GROUPS
};

module.exports = { TYPE_SPEC_GROUPS };
