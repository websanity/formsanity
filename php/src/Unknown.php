<?php

declare(strict_types=1);

namespace WebSanity\FormSanity;

/** The position a server takes on payload keys the markup does not define, per the Unknown Fields section of the submission protocol. */
enum Unknown
{
	case Ignore;
	case Reject;
}
