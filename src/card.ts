/**
 * Room Summary Card Component
 *
 * A custom element that displays a summary of room information in Home Assistant.
 * This card shows room state, climate information, and various entity states in a
 * grid layout with interactive elements.
 *
 * @version See package.json
 */

import { CSSResult, LitElement, html, nothing } from 'lit';
import { state } from 'lit/decorators.js';

import { version } from '../package.json';
import { actionHandler, handleClickAction } from './action-handler';
import {
  createStateIcon,
  getDevice,
  getEntity,
  getIconEntities,
  getProblemEntities,
  getRoomEntity,
  getState,
} from './helpers';
import { getCardStyles, getEntityIconStyles, styles } from './styles';
import type { Config, EntityInformation } from './types/config';
import type { HomeAssistant } from './types/homeassistant';

const equal = require('fast-deep-equal');

export class RoomSummaryCard extends LitElement {
  /**
   * Card configuration object
   */
  @state()
  private _config!: Config;

  /**
   * Array of entity states to display in the card
   */
  @state()
  private _states!: EntityInformation[];

  /**
   * Information about the room entity
   */
  @state()
  private _roomEntity!: EntityInformation;

  /**
   * List of entity IDs that have problems
   */
  @state()
  private _problemEntities: string[] = [];

  /**
   * Indicates if any problems exist in the room
   */
  @state()
  private _problemExists: boolean = false;

  /**
   * Home Assistant instance
   * Not marked as @state as it's handled differently
   */
  private _hass!: HomeAssistant;

  constructor() {
    super();
    console.info(
      `%c🐱 Poat's Tools: room-summary-card - ${version}`,
      'color: #CFC493;',
    );
  }

  /**
   * Renders the room summary card
   * @returns {TemplateResult} The rendered HTML template
   */
  override render() {
    if (!this._states) {
      return html``;
    }

    const { textStyle } = getEntityIconStyles(this._roomEntity.state);
    const cardStyle = getCardStyles(
      this._hass,
      this._config,
      this._roomEntity.state,
    );

    // Use the provided label from _config if available; otherwise, fall back to the formatted area name.
    const areaName = (this._config && this._config.label)
      ? this._config.label
      : this._formatAreaName();

    return html`
      <div class="card" style="${cardStyle}">
        <div class="grid">
          <!-- Room Name -->
          <div
            class="name text"
            style=${textStyle}
            @action=${handleClickAction(this, this._roomEntity)}
            .actionHandler=${actionHandler(this._roomEntity)}
          >
            ${areaName}
          </div>

          <!-- Climate Information -->
          <div
            class="label text"
            style=${textStyle}
            @action=${handleClickAction(this, this._roomEntity)}
            .actionHandler=${actionHandler(this._roomEntity)}
          >
            ${this._getLabel()} <br />
            <span class="stats">${this._getAreaStatistics()}</span>
          </div>

          <!-- State Icons -->
          ${createStateIcon(this, this._hass, this._roomEntity, ['room'])}
          ${this._states.map((s, i) =>
            createStateIcon(this, this._hass, s, ['entity', `entity-${i + 1}`]),
          )}

          <!-- Problem Indicator -->
          ${this._renderProblemIndicator()}
        </div>
      </div>
    `;
  }

  /**
   * Returns the component's styles
   */
  static override get styles(): CSSResult {
    return styles;
  }

  /**
   * Sets up the card configuration
   * @param {Config} config - The card configuration
   */
  setConfig(config: Config) {
    const cardConfig = {
      humidity_sensor: `sensor.${config.area}_climate_humidity`,
      temperature_sensor: `sensor.${config.area}_climate_air_temperature`,
      ...config,
    };
    if (!equal(cardConfig, this._config)) {
      this._config = cardConfig;
    }
  }

  /**
   * Updates the card's state when Home Assistant state changes
   * @param {HomeAssistant} hass - The Home Assistant instance
   */
  set hass(hass: HomeAssistant) {
    this._hass = hass;

    const states = getIconEntities(hass, this._config);
    const roomEntity = getRoomEntity(hass, this._config);
    const { problemEntities, problemExists } = getProblemEntities(
      hass,
      this._config.area,
    );

    this._problemExists = problemExists;

    // Update states only if they've changed
    if (!equal(roomEntity, this._roomEntity)) {
      this._roomEntity = roomEntity;
    }
    if (!equal(states, this._states)) {
      this._states = states;
    }
    if (!equal(problemEntities, this._problemEntities)) {
      this._problemEntities = problemEntities;
    }
  }

  /**
   * Formats the area name with proper capitalization
   * @returns {string} Formatted area name
   */
  private _formatAreaName(): string {
    return this._config.area
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  /**
   * Gets the climate label (temperature and humidity)
   * @returns {string} Formatted climate information
   */
  private _getLabel(): string {
    if (!this._hass || !this._config.area) return '';

    // Get the temperature sensor state (as a string)
    const sensorTemp = getState(this._hass, this._config.temperature_sensor)?.state;
    const humidity = getState(this._hass, this._config.humidity_sensor)?.state;

    // Use the configured unit or default to 'C' (for Celsius)
    const unit = (this._config.unit || 'C').toUpperCase();

    return `${sensorTemp}°${unit} - ${humidity}%`;
  }

  /**
   * Gets statistics about devices and entities in the area
   * @returns {string} Formatted statistics
   */
  private _getAreaStatistics(): string {
    if (!this._hass || !this._config.area) return '';

    const devices = Object.keys(this._hass.devices).filter(
      (k) => getDevice(this._hass, k).area_id === this._config.area,
    );

    const entities = Object.keys(this._hass.entities).filter((k) => {
      const entity = getEntity(this._hass, k);
      return (
        entity.area_id === this._config.area ||
        devices.includes(entity.device_id)
      );
    });

    return [
      [devices.length, 'devices'],
      [entities.length, 'entities'],
    ]
      .filter((count) => count.length > 0)
      .map(([count, type]) => `${count} ${type}`)
      .join(' ');
  }

  /**
   * Renders the problem indicator icon if problems exist
   * @returns {TemplateResult | typeof nothing} The rendered problem indicator or nothing
   */
  private _renderProblemIndicator() {
    if (this._problemEntities.length === 0) {
      return nothing;
    }

    return html`
      <ha-icon
        .icon=${`mdi:numeric-${this._problemEntities.length}`}
        class="status-entities"
        style="background-color: ${this._problemExists
          ? 'rgba(var(--color-red), 0.8)'
          : 'rgba(var(--color-green), 0.6)'}"
      />
    `;
  }
}
