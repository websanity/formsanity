<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Payload;

/** One uploaded file, reduced to the three facts the file rules judge. */
final readonly class Upload
{
	public function __construct(public string $name, public string $type, public int $size)
	{
	}
}
