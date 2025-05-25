import { GuestDeviceService } from '../../services/guest-device/guest-device.service';

// This interface exposes the internal properties of EventService needed by GuestEventController
export interface EventServiceExtended {
    guestDeviceService: GuestDeviceService;
}
